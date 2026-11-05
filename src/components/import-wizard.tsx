"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { importTasks, type ImportResult } from "@/lib/import-actions";
import { IMPORT_FIELDS, guessMapping, mapRows, parseDateText, type ImportField, type ParsedSheet } from "@/lib/import-format";
import { cleanProject, statusFromText, statusMeta } from "@/lib/constants";

const CHUNK = 200;

export function ImportWizard({
  members,
  currentUserId,
  isAdmin,
}: {
  members: { id: number; name: string }[];
  currentUserId: number;
  isAdmin: boolean;
}) {
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [assignee, setAssignee] = useState(String(currentUserId));
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const sheet = sheets?.[sheetIdx];
  const rows = useMemo(() => (sheet ? mapRows(sheet, mapping) : []), [sheet, mapping]);

  const stats = useMemo(() => {
    const withTitle = rows.filter((r) => r.title);
    const dates = withTitle.map((r) => parseDateText(r.date)).filter(Boolean) as string[];
    const perDay = new Map<string, number>();
    for (const d of dates) perDay.set(d, (perDay.get(d) ?? 0) + 1);
    const statuses = new Map<string, number>();
    for (const r of withTitle) {
      const s = r.status ? statusFromText(r.status) : r.date ? "done" : "todo";
      statuses.set(s, (statuses.get(s) ?? 0) + 1);
    }
    const badDates = withTitle.filter((r) => r.date && !parseDateText(r.date)).length;
    const projects = new Set(withTitle.map((r) => cleanProject(r.project ?? "")).filter(Boolean));
    return {
      total: withTitle.length,
      noTitle: rows.length - withTitle.length,
      from: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      to: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
      days: perDay.size,
      busiest: [...perDay.entries()].sort((a, b) => b[1] - a[1])[0],
      statuses: [...statuses.entries()],
      badDates,
      projects: projects.size,
    };
  }, [rows]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    setSheets(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: "Upload failed." }));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      setSheets(data.sheets);
      setSheetIdx(0);
      setMapping(guessMapping(data.sheets[0].headers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function pickSheet(i: number) {
    setSheetIdx(i);
    if (sheets) setMapping(guessMapping(sheets[i].headers));
    setResult(null);
  }

  async function runImport() {
    if (!rows.length) return;
    setBusy(true);
    setError("");
    setProgress(0);
    const total: ImportResult = { added: 0, updated: 0, skipped: 0, problems: [] };
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const r = await importTasks(rows.slice(i, i + CHUNK), {
          defaultAssigneeId: isAdmin ? Number(assignee) || null : currentUserId,
          updateExisting,
          rowOffset: i,
        });
        total.added += r.added;
        total.updated += r.updated;
        total.skipped += r.skipped;
        total.problems.push(...r.problems);
        setProgress(Math.min(rows.length, i + CHUNK));
      }
      setResult(total);
    } catch (e) {
      setError(
        `Import stopped after ${total.added + total.updated + total.skipped} rows: ${e instanceof Error ? e.message : "server error"}. ` +
          "You can safely run it again: rows already imported will be matched, not duplicated.",
      );
      setResult(total);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-stone-800">1 · Choose your spreadsheet</h2>
        <p className="mt-1 text-sm text-stone-500">
          Excel (.xlsx) or CSV. The first row should have column names like <i>Date, Task, Project, Status</i>.{" "}
          <a href="/api/export?type=template" className="text-brand-700 hover:underline">Download a blank template</a>
        </p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
          <span className="text-sm font-medium text-stone-700">{fileName || "Click to choose a file"}</span>
          <span className="mt-1 text-xs text-stone-400">{busy && !sheets ? "Reading file…" : "Max 4 MB"}</span>
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {sheet && (
        <>
          {/* Step 2 */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-stone-800">2 · Check the columns</h2>
            <p className="mt-1 text-sm text-stone-500">We matched your columns automatically. Change any that are wrong.</p>
            {sheets && sheets.length > 1 && (
              <div className="mt-4 max-w-xs">
                <label className="label" htmlFor="sheet">Sheet</label>
                <select id="sheet" className="input" value={sheetIdx} onChange={(e) => pickSheet(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>{s.name} ({s.rows.length} rows)</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={`map-${f.key}`}>
                    {f.label}
                    {"required" in f && f.required && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    id={`map-${f.key}`}
                    className={`input ${mapping[f.key] !== undefined ? "border-brand-300 bg-brand-50/30" : ""}`}
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMapping((m) => {
                        const next = { ...m };
                        if (v < 0) delete next[f.key];
                        else next[f.key] = v;
                        return next;
                      });
                    }}
                  >
                    <option value={-1}>— not in file —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2">
              {isAdmin && (
                <div>
                  <label className="label" htmlFor="assignee">
                    Assign tasks to{mapping.assignee !== undefined ? " (when the row has no name)" : ""}
                  </label>
                  <select id="assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Nobody (unassigned)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm text-stone-600 sm:pt-6">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span>
                  Update tasks that were already imported
                  <span className="block text-xs text-stone-400">Same date + same task title = same task. New rows are always added; nothing is duplicated.</span>
                </span>
              </label>
            </div>
          </section>

          {/* Step 3 */}
          <section className="card overflow-hidden">
            <div className="p-5 pb-3">
              <h2 className="text-sm font-semibold text-stone-800">3 · Preview &amp; import</h2>
              {mapping.title === undefined ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Choose which column has the task title.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Chip>{stats.total} tasks</Chip>
                  {stats.from && <Chip>{stats.from === stats.to ? stats.from : `${stats.from} → ${stats.to}`}</Chip>}
                  {stats.days > 0 && <Chip>{stats.days} days</Chip>}
                  {stats.busiest && stats.busiest[1] > 1 && <Chip>Busiest day: {stats.busiest[0]} ({stats.busiest[1]} tasks)</Chip>}
                  {stats.projects > 0 && <Chip>{stats.projects} projects</Chip>}
                  {stats.statuses.map(([s, n]) => (
                    <span key={s} className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${statusMeta(s).cls}`}>{statusMeta(s).label}: {n}</span>
                  ))}
                  {stats.noTitle > 0 && <Chip tone="warn">{stats.noTitle} rows without a title will be skipped</Chip>}
                  {stats.badDates > 0 && <Chip tone="warn">{stats.badDates} unreadable dates (today will be used)</Chip>}
                </div>
              )}
            </div>
            <div className="max-h-96 overflow-auto border-t border-stone-100">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-stone-50">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Task</th>
                    <th className="th">Project</th>
                    <th className="th">Status</th>
                    <th className="th">What was done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.slice(0, 50).map((r, i) => {
                    const st = r.status ? statusFromText(r.status) : r.date ? "done" : "todo";
                    return (
                      <tr key={i} className={r.title ? "" : "opacity-40"}>
                        <td className="td whitespace-nowrap text-stone-600">{parseDateText(r.date) ?? (r.date ? <span className="text-amber-700">{r.date}?</span> : "today")}</td>
                        <td className="td max-w-72 truncate font-medium text-stone-800" title={r.title}>{r.title || "(no title)"}</td>
                        <td className="td max-w-48 truncate text-stone-600" title={r.project}>{cleanProject(r.project ?? "")}</td>
                        <td className="td whitespace-nowrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${statusMeta(st).cls}`}>{statusMeta(st).label}</span>
                          {r.status && r.status.toLowerCase() !== statusMeta(st).label.toLowerCase() && <span className="ml-1 text-xs text-stone-400">{r.status}</span>}
                        </td>
                        <td className="td max-w-80 truncate text-stone-500" title={r.description}>{r.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 50 && <p className="px-4 py-2 text-xs text-stone-400">…and {rows.length - 50} more rows</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 p-4">
              <button className="btn-primary" disabled={busy || mapping.title === undefined || stats.total === 0} onClick={runImport}>
                {busy ? `Importing… ${progress}/${rows.length}` : `Import ${stats.total} tasks`}
              </button>
              {busy && (
                <div className="h-2 w-48 rounded-full bg-stone-100">
                  <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(progress / Math.max(1, rows.length)) * 100}%` }} />
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="card border-emerald-200 p-5">
          <h2 className="text-sm font-semibold text-emerald-800">Import finished</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
            <Big n={result.added} label="added" />
            <Big n={result.updated} label="updated" />
            <Big n={result.skipped} label="skipped" />
          </div>
          {result.problems.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-amber-800">{result.problems.length} notes about individual rows</summary>
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5 text-xs text-stone-600">
                {result.problems.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.from && <Link href={`/monthly?month=${stats.from.slice(0, 7)}`} className="btn-primary">See monthly report</Link>}
            {stats.from && <Link href={`/weekly?date=${stats.to}`} className="btn-ghost">Weekly summary</Link>}
            <Link href="/tasks?status=all" className="btn-ghost">All tasks</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${tone === "warn" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-stone-50 text-stone-700 ring-stone-200"}`}>
      {children}
    </span>
  );
}

function Big({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums text-stone-900">{n}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
