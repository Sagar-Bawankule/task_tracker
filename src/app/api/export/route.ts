import { getCurrentUser } from "@/lib/auth";
import { logsBetween, tasksCompletedBetween } from "@/lib/data";
import { isDateStr } from "@/lib/dates";
import { priorityMeta, statusMeta } from "@/lib/constants";

function csv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          let s = v == null ? "" : String(v);
          if (/^[=+\-@]/.test(s)) s = `'${s}`; // avoid spreadsheet formula injection
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDateStr(from) || !isDateStr(to) || from > to) return new Response("Invalid date range", { status: 400 });

  const requested = Number(url.searchParams.get("user"));
  const userId = user.role === "admin" ? (Number.isInteger(requested) && requested > 0 ? requested : null) : user.id;

  let body: string;
  let name: string;
  if (url.searchParams.get("type") === "tasks") {
    const tasks = await tasksCompletedBetween(from, to, userId);
    body = csv([
      ["Completed on", "Task", "Assigned to", "Category", "Priority", "Status", "Due date", "Created on", "Details"],
      ...tasks.map((t) => [t.completed_on, t.title, t.assignee_name, t.category, priorityMeta(t.priority).label, statusMeta(t.status).label, t.due_date, t.created_on, t.description]),
    ]);
    name = `completed-tasks_${from}_to_${to}.csv`;
  } else {
    const logs = await logsBetween(from, to, userId);
    body = csv([
      ["Date", "Team member", "Hours", "Task", "Category", "Work done"],
      ...[...logs].reverse().map((l) => [l.log_date, l.user_name, l.hours, l.task_title, l.task_category ?? "Other work", l.note]),
    ]);
    name = `work-log_${from}_to_${to}.csv`;
  }

  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
