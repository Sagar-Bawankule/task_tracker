"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { addDayTasks } from "@/lib/import-actions";
import { STATUSES } from "@/lib/constants";

type Row = { key: number; title: string; description: string; project: string; status: string; hours: string };
let nextKey = 1;
const blank = (project = ""): Row => ({ key: nextKey++, title: "", description: "", project, status: "done", hours: "" });

export function DayTasksForm({
  date,
  projects,
  members,
}: {
  date: string;
  projects: string[];
  members?: { id: number; name: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank(), blank()]);
  const [state, action, pending] = useActionState(addDayTasks, undefined);

  useEffect(() => {
    if (state?.ok) setRows([blank(), blank(), blank()]);
  }, [state]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.title.trim()).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="p-4"
    >
      <input type="hidden" name="date" value={date} />
      <datalist id="day-projects">
        {projects.map((p) => <option key={p} value={p} />)}
      </datalist>

      {members && members.length > 1 && (
        <div className="mb-3 max-w-xs">
          <label className="label" htmlFor="day-assignee">Whose tasks?</label>
          <select className="input" id="day-assignee" name="assignee_id" defaultValue="">
            <option value="">Mine</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="rounded-lg border border-stone-200 bg-stone-50/40 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-xs font-medium text-stone-400">{i + 1}.</span>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6">
                <input
                  name="title"
                  className="input sm:col-span-4"
                  placeholder="Task, e.g. Fixed product page images"
                  value={r.title}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  aria-label={`Task ${i + 1} title`}
                />
                <input
                  name="project"
                  list="day-projects"
                  className="input sm:col-span-2"
                  placeholder="Project"
                  value={r.project}
                  onChange={(e) => update(r.key, { project: e.target.value })}
                  aria-label={`Task ${i + 1} project`}
                />
                <input
                  name="description"
                  className="input sm:col-span-4"
                  placeholder="What was done (optional)"
                  value={r.description}
                  onChange={(e) => update(r.key, { description: e.target.value })}
                  aria-label={`Task ${i + 1} details`}
                />
                <select
                  name="status"
                  className="input sm:col-span-1"
                  value={r.status}
                  onChange={(e) => update(r.key, { status: e.target.value })}
                  aria-label={`Task ${i + 1} status`}
                >
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input
                  name="hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  className="input sm:col-span-1"
                  placeholder="Hrs"
                  value={r.hours}
                  onChange={(e) => update(r.key, { hours: e.target.value })}
                  aria-label={`Task ${i + 1} hours`}
                />
              </div>
              <button
                type="button"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                className="mt-1.5 rounded px-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove task ${i + 1}`}
                title="Remove row"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={() => setRows((rs) => [...rs, blank(rs[rs.length - 1]?.project)])}>
          + Add another task
        </button>
        <button className="btn-primary ml-auto" disabled={pending || filled === 0}>
          {pending ? "Saving…" : `Save ${filled || ""} task${filled === 1 ? "" : "s"}`}
        </button>
      </div>
      {state?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
