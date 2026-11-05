"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "./db";
import { requireAdmin, requireUser, type User } from "./auth";
import { SESSION_COOKIE, SESSION_DAYS, signSession } from "./session";
import { isDateStr, todayStr } from "./dates";
import { isPriority, isStatus } from "./constants";

export type FormState = { error?: string; ok?: string; email?: string; name?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

function safeReturn(fd: FormData, fallback: string) {
  const r = str(fd, "returnTo");
  return r.startsWith("/") && !r.startsWith("//") ? r : fallback;
}

async function startSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/* ---------------- Auth ---------------- */

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const user = await queryOne<{ id: number; password_hash: string; active: boolean }>(
    "SELECT id, password_hash, active FROM users WHERE email = $1",
    [email],
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Incorrect email or password.", email };
  }
  if (!user.active) return { error: "This account has been deactivated. Contact your admin.", email };
  await startSession(user.id);
  redirect("/");
}

export async function setupAdmin(_: FormState, fd: FormData): Promise<FormState> {
  const existing = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
  if (existing && existing.n > 0) return { error: "Setup is already complete. Please sign in." };
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!name || !email.includes("@")) return { error: "Enter your name and a valid email.", name, email };
  if (password.length < 6) return { error: "Password must be at least 6 characters.", name, email };
  const row = await queryOne<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, 'admin', 'Management') RETURNING id`,
    [name, email, await bcrypt.hash(password, 10)],
  );
  await startSession(row!.id);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = str(fd, "current");
  const next = str(fd, "next");
  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) return { error: "Current password is wrong." };
  if (next.length < 6) return { error: "New password must be at least 6 characters." };
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), user.id]);
  return { ok: "Password updated." };
}

/* ---------------- Tasks ---------------- */

async function canEditTask(user: User, taskId: number) {
  if (user.role === "admin") return true;
  const t = await queryOne<{ assignee_id: number | null; created_by: number | null }>(
    "SELECT assignee_id, created_by FROM tasks WHERE id = $1",
    [taskId],
  );
  return !!t && (t.assignee_id === user.id || t.created_by === user.id);
}

export async function saveTask(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const title = str(fd, "title");
  if (!title) throw new Error("Task title is required.");
  const description = str(fd, "description");
  const category = str(fd, "category") || "General";
  const priority = isPriority(str(fd, "priority")) ? str(fd, "priority") : "medium";
  const status = isStatus(str(fd, "status")) ? str(fd, "status") : "todo";
  const due = str(fd, "due_date");
  const dueDate = isDateStr(due) ? due : null;
  let assigneeId = num(fd, "assignee_id");
  if (user.role !== "admin") assigneeId = assigneeId ?? user.id;
  const today = todayStr();
  const extra = [
    str(fd, "project").slice(0, 120),
    str(fd, "source").slice(0, 60),
    str(fd, "output"),
    str(fd, "notes"),
    str(fd, "link").slice(0, 1000),
    str(fd, "status_note").slice(0, 200),
  ];
  const wd = str(fd, "work_date");
  const workDate = isDateStr(wd) && wd <= today ? wd : today;
  const cd = str(fd, "completed_on");
  const completedInput = isDateStr(cd) && cd <= today ? cd : null;

  if (id) {
    if (!(await canEditTask(user, id))) throw new Error("You can't edit this task.");
    await query(
      `UPDATE tasks SET title=$1, description=$2, category=$3, priority=$4, status=$5, assignee_id=$6, due_date=$7,
         completed_on = CASE WHEN $5 = 'done' THEN COALESCE($8, completed_on, $9) ELSE NULL END,
         created_on = $10, project=$11, source=$12, output=$13, notes=$14, link=$15, status_note=$16,
         updated_at = now()
       WHERE id = $17`,
      [title, description, category, priority, status, assigneeId, dueDate, completedInput, today, workDate, ...extra, id],
    );
  } else {
    await query(
      `INSERT INTO tasks (title, description, category, priority, status, assignee_id, created_by, due_date, created_on, completed_on,
         project, source, output, notes, link, status_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [title, description, category, priority, status, assigneeId, user.id, dueDate, workDate,
        status === "done" ? completedInput ?? workDate : null, ...extra],
    );
  }
  revalidatePath("/", "layout");
  redirect(safeReturn(fd, "/tasks"));
}

export async function setTaskStatus(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const status = str(fd, "status");
  if (!id || !isStatus(status)) return;
  if (!(await canEditTask(user, id))) throw new Error("You can't update this task.");
  await query(
    `UPDATE tasks SET status = $1,
       completed_on = CASE WHEN $1 = 'done' THEN COALESCE(completed_on, $2) ELSE NULL END,
       updated_at = now()
     WHERE id = $3`,
    [status, todayStr(), id],
  );
  revalidatePath("/", "layout");
}

export async function deleteTask(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  if (!(await canEditTask(user, id))) throw new Error("You can't delete this task.");
  await query("DELETE FROM tasks WHERE id = $1", [id]);
  revalidatePath("/", "layout");
  redirect(safeReturn(fd, "/tasks"));
}

/* ---------------- Daily work log ---------------- */

export async function addLog(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const date = str(fd, "log_date");
  const hours = Number(fd.get("hours"));
  const note = str(fd, "note");
  const taskId = num(fd, "task_id");
  let userId = user.id;
  const forUser = num(fd, "user_id");
  if (forUser && user.role === "admin") userId = forUser;

  if (!isDateStr(date)) return { error: "Pick a valid date." };
  if (date > todayStr()) return { error: "You can't log work for a future date." };
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return { error: "Hours must be between 0 and 24." };
  if (!note && !taskId) return { error: "Describe the work or pick a task." };

  await query("INSERT INTO work_logs (user_id, task_id, log_date, hours, note) VALUES ($1,$2,$3,$4,$5)", [
    userId,
    taskId,
    date,
    Math.round(hours * 4) / 4,
    note,
  ]);
  if (taskId && fd.get("mark_done") === "on") {
    await query(
      `UPDATE tasks SET status='done', completed_on = COALESCE(completed_on, $1), updated_at = now()
       WHERE id = $2 AND ($3 OR assignee_id = $4 OR created_by = $4)`,
      [date, taskId, user.role === "admin", user.id],
    );
  }
  revalidatePath("/", "layout");
  return { ok: "Work logged." };
}

export async function deleteLog(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  if (user.role === "admin") await query("DELETE FROM work_logs WHERE id = $1", [id]);
  else await query("DELETE FROM work_logs WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/", "layout");
}

/* ---------------- Team (admin) ---------------- */

export async function addMember(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const department = str(fd, "department");
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  if (!name || !email.includes("@")) return { error: "Name and a valid email are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  const exists = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (exists) return { error: "A team member with this email already exists." };
  await query("INSERT INTO users (name, email, password_hash, role, department) VALUES ($1,$2,$3,$4,$5)", [
    name,
    email,
    await bcrypt.hash(password, 10),
    role,
    department,
  ]);
  revalidatePath("/", "layout");
  return { ok: `${name} added. Share their email and password so they can sign in.` };
}

export async function updateMember(fd: FormData) {
  const admin = await requireAdmin();
  const id = num(fd, "id");
  if (!id) return;
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  const active = fd.get("active") === "on";
  if (id === admin.id && (role !== "admin" || !active)) {
    throw new Error("You can't remove your own admin access or deactivate yourself.");
  }
  await query("UPDATE users SET name = $1, department = $2, role = $3, active = $4 WHERE id = $5", [
    str(fd, "name") || "Unnamed",
    str(fd, "department"),
    role,
    active,
    id,
  ]);
  const password = str(fd, "password");
  if (password) {
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(password, 10), id]);
  }
  revalidatePath("/", "layout");
}
