"use server";

import { revalidatePath } from "next/cache";
import { query } from "./db";
import { requireUser, type User } from "./auth";
import { todayStr } from "./dates";
import { cleanProject, isPriority, statusFromText, statusMeta } from "./constants";
import { parseDateText, type ImportRow } from "./import-format";
import type { FormState } from "./actions";

export type ImportResult = { added: number; updated: number; skipped: number; problems: string[] };

const MAX_ROWS_PER_CALL = 300;
const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);

async function importRowsFor(
  user: User,
  rows: ImportRow[],
  opts: { defaultAssigneeId: number | null; updateExisting: boolean; rowOffset?: number },
): Promise<ImportResult> {
  const isAdmin = user.role === "admin";
  const today = todayStr();
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, problems: [] };
  const members = await query<{ id: number; name: string; email: string }>("SELECT id, name, email FROM users");
  const byKey = new Map<string, number>();
  for (const m of members) {
    byKey.set(m.email.toLowerCase(), m.id);
    byKey.set(m.name.toLowerCase().trim(), m.id);
  }
  const defaultAssignee = isAdmin
    ? opts.defaultAssigneeId && members.some((m) => m.id === opts.defaultAssigneeId)
      ? opts.defaultAssigneeId
      : null
    : user.id;

  type Prepared = {
    key: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    assignee: number | null;
    due: string | null;
    created: string;
    completed: string | null;
    project: string;
    source: string;
    output: string;
    notes: string;
    link: string;
    statusNote: string;
    hours: number;
  };
  const prepared: Prepared[] = [];
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    const rowNo = (opts.rowOffset ?? 0) + i + 1;
    const title = clip(r.title, 300);
    if (!title) {
      result.skipped++;
      if (Object.values(r).some((v) => v && String(v).trim())) result.problems.push(`Row ${rowNo}: no task title, skipped.`);
      return;
    }
    let created = parseDateText(r.date);
    let due = parseDateText(r.due_date);
    if (r.date && !created) result.problems.push(`Row ${rowNo}: couldn’t read date “${r.date}”, used today.`);
    if (created && created > today) {
      // a future "date" is really a plan: treat it as the due date
      due = due ?? created;
      created = today;
    }
    created = created ?? today;

    let assignee = defaultAssignee;
    if (isAdmin && r.assignee) {
      const found = byKey.get(r.assignee.toLowerCase().trim());
      if (found) assignee = found;
      else result.problems.push(`Row ${rowNo}: no team member called “${r.assignee}”, assigned to the default.`);
    }

    const statusText = clip(r.status, 120);
    const status = statusText ? statusFromText(statusText) : r.date || r.completed_on ? "done" : "todo";
    const statusNote =
      clip(r.status_note, 200) || (statusText && statusText !== status && statusText.toLowerCase() !== statusMeta(status).label.toLowerCase() ? statusText : "");
    const completedText = parseDateText(r.completed_on);
    const completed = status === "done" ? (completedText && completedText <= today ? completedText : created) : null;
    const pr = (r.priority ?? "").toLowerCase().trim();
    const link = clip(r.link, 1000);
    const hours = Number(r.hours);

    const key = `${created}|${title.toLowerCase()}|${assignee ?? ""}`;
    if (seen.has(key)) {
      result.skipped++;
      result.problems.push(`Row ${rowNo}: same task appears twice for ${created}, skipped the repeat.`);
      return;
    }
    seen.add(key);

    prepared.push({
      key,
      title,
      description: clip(r.description, 5000),
      category: clip(r.category, 80) || "General",
      priority: isPriority(pr) ? pr : pr === "critical" ? "urgent" : "medium",
      status,
      assignee,
      due,
      created,
      completed,
      project: cleanProject(r.project ?? ""),
      source: clip(r.source, 60),
      output: clip(r.output, 2000),
      notes: clip(r.notes, 2000),
      link: /^https?:\/\//i.test(link) ? link : "",
      statusNote,
      hours: Number.isFinite(hours) && hours > 0 && hours <= 24 ? Math.round(hours * 4) / 4 : 0,
    });
  });

  if (!prepared.length) return result;

  // Find tasks that already exist (same day + same title + same person) so re-importing never duplicates
  const dates = [...new Set(prepared.map((p) => p.created))];
  const existing = await query<{ id: number; title: string; created_on: string; assignee_id: number | null }>(
    "SELECT id, title, created_on, assignee_id FROM tasks WHERE created_on = ANY($1::text[])",
    [dates],
  );
  const existingByKey = new Map(existing.map((e) => [`${e.created_on}|${e.title.trim().toLowerCase()}|${e.assignee_id ?? ""}`, e.id]));

  const toInsert: Prepared[] = [];
  for (const p of prepared) {
    const id = existingByKey.get(p.key);
    if (!id) {
      toInsert.push(p);
      continue;
    }
    if (!opts.updateExisting) {
      result.skipped++;
      continue;
    }
    if (!isAdmin) {
      const own = await query("SELECT 1 FROM tasks WHERE id = $1 AND (assignee_id = $2 OR created_by = $2)", [id, user.id]);
      if (!own.length) {
        result.skipped++;
        continue;
      }
    }
    await query(
      `UPDATE tasks SET status = $1, completed_on = $2, status_note = $3,
         description = CASE WHEN $4 <> '' THEN $4 ELSE description END,
         project = CASE WHEN $5 <> '' THEN $5 ELSE project END,
         source = CASE WHEN $6 <> '' THEN $6 ELSE source END,
         output = CASE WHEN $7 <> '' THEN $7 ELSE output END,
         notes = CASE WHEN $8 <> '' THEN $8 ELSE notes END,
         link = CASE WHEN $9 <> '' THEN $9 ELSE link END,
         due_date = COALESCE($10, due_date), updated_at = now()
       WHERE id = $11`,
      [p.status, p.completed, p.statusNote, p.description, p.project, p.source, p.output, p.notes, p.link, p.due, id],
    );
    result.updated++;
  }

  // Insert new tasks in batches
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const params: unknown[] = [];
    const values = batch.map((p) => {
      const vals = [p.title, p.description, p.category, p.priority, p.status, p.assignee, user.id, p.due, p.created, p.completed,
        p.project, p.source, p.output, p.notes, p.link, p.statusNote];
      const ph = vals.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${ph.join(",")})`;
    });
    const inserted = await query<{ id: number }>(
      `INSERT INTO tasks (title, description, category, priority, status, assignee_id, created_by, due_date, created_on, completed_on,
         project, source, output, notes, link, status_note)
       VALUES ${values.join(",")} RETURNING id`,
      params,
    );
    result.added += inserted.length;
    // optional hours -> a work log entry for that day
    for (let j = 0; j < batch.length; j++) {
      const p = batch[j];
      if (p.hours > 0 && p.assignee && inserted[j]) {
        await query("INSERT INTO work_logs (user_id, task_id, log_date, hours, note) VALUES ($1,$2,$3,$4,$5)", [
          p.assignee,
          inserted[j].id,
          p.created,
          p.hours,
          p.description.slice(0, 500),
        ]);
      }
    }
  }
  return result;
}

/** Import rows from a spreadsheet (called in chunks from the Import page) */
export async function importTasks(
  rows: ImportRow[],
  opts: { defaultAssigneeId: number | null; updateExisting: boolean; rowOffset: number },
): Promise<ImportResult> {
  const user = await requireUser();
  if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_CALL) throw new Error("Too many rows in one request.");
  const clean = rows.map((r) => {
    const o: ImportRow = {};
    for (const [k, v] of Object.entries(r ?? {})) if (typeof v === "string") o[k as keyof ImportRow] = v;
    return o;
  });
  const res = await importRowsFor(user, clean, {
    defaultAssigneeId: Number.isInteger(opts?.defaultAssigneeId) ? opts.defaultAssigneeId : null,
    updateExisting: !!opts?.updateExisting,
    rowOffset: Number(opts?.rowOffset) || 0,
  });
  revalidatePath("/", "layout");
  return res;
}

/** "Add several tasks for one day" form on the Daily page */
export async function addDayTasks(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const date = String(fd.get("date") ?? "");
  if (!parseDateText(date)) return { error: "Pick a valid date." };
  if (date > todayStr()) return { error: "You can’t add finished work for a future date. Use a due date on the task instead." };
  const all = (k: string) => fd.getAll(k).map((v) => String(v));
  const titles = all("title");
  const rows: ImportRow[] = titles.map((title, i) => ({
    title,
    date,
    description: all("description")[i],
    project: all("project")[i],
    status: all("status")[i],
    hours: all("hours")[i],
  }));
  if (!rows.some((r) => r.title?.trim())) return { error: "Enter at least one task." };
  const assignee = Number(fd.get("assignee_id"));
  const res = await importRowsFor(user, rows, {
    defaultAssigneeId: user.role === "admin" && assignee > 0 ? assignee : user.id,
    updateExisting: false,
  });
  revalidatePath("/", "layout");
  const dup = res.skipped - rows.filter((r) => !r.title?.trim()).length;
  return {
    ok: `${res.added} task${res.added === 1 ? "" : "s"} added for this day.${dup > 0 ? ` ${dup} already existed and ${dup === 1 ? "was" : "were"} skipped.` : ""}`,
  };
}
