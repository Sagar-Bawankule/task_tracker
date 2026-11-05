import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { logsBetween, type Task } from "@/lib/data";
import { isDateStr, todayStr } from "@/lib/dates";
import { priorityMeta, statusMeta } from "@/lib/constants";

export const runtime = "nodejs";

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

// Same column names the importer understands, so an export can be edited and re-imported.
const TASK_COLUMNS: { header: string; width: number; get: (t: Task) => string | null }[] = [
  { header: "Date", width: 12, get: (t) => t.created_on },
  { header: "Task", width: 50, get: (t) => t.title },
  { header: "Project", width: 30, get: (t) => t.project },
  { header: "What Was Done", width: 60, get: (t) => t.description },
  { header: "Status", width: 13, get: (t) => statusMeta(t.status).label },
  { header: "Status Note", width: 22, get: (t) => t.status_note },
  { header: "Assigned To", width: 18, get: (t) => t.assignee_name },
  { header: "Category", width: 16, get: (t) => t.category },
  { header: "Priority", width: 10, get: (t) => priorityMeta(t.priority).label },
  { header: "Due Date", width: 12, get: (t) => t.due_date },
  { header: "Completed On", width: 13, get: (t) => t.completed_on },
  { header: "Source", width: 10, get: (t) => t.source },
  { header: "Output / Files", width: 40, get: (t) => t.output },
  { header: "Notes", width: 40, get: (t) => t.notes },
  { header: "Link", width: 30, get: (t) => t.link },
];

async function xlsxResponse(tasks: Task[], name: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tasks", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = TASK_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC22C5F" } };
  for (const t of tasks) {
    const row = ws.addRow(TASK_COLUMNS.map((c) => c.get(t) ?? ""));
    const linkCell = row.getCell(TASK_COLUMNS.length);
    if (t.link) linkCell.value = { text: t.link, hyperlink: t.link };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TASK_COLUMNS.length } };
  ws.getColumn(4).alignment = { wrapText: false };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.category, t.priority, t.status, t.assignee_id,
         a.name AS assignee_name, NULL AS created_by_name, t.due_date, t.created_on, t.completed_on,
         t.project, t.source, t.output, t.notes, t.link, t.status_note
  FROM tasks t LEFT JOIN users a ON a.id = t.assignee_id`;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "logs";

  if (type === "template") {
    const sample = {
      id: 0, title: "Example: Update Diwali banner on homepage", description: "Replaced banner, checked mobile view",
      category: "Marketing", priority: "medium", status: "done", assignee_id: null, assignee_name: user.name,
      created_by_name: null, due_date: null, created_on: todayStr(), completed_on: todayStr(), project: "Homepage",
      source: "", output: "", notes: "Delete this example row", link: "", status_note: "",
    } satisfies Task;
    return xlsxResponse([sample], "task-import-template.xlsx");
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDateStr(from) || !isDateStr(to) || from > to) return new Response("Invalid date range", { status: 400 });
  const requested = Number(url.searchParams.get("user"));
  const userId = user.role === "admin" ? (Number.isInteger(requested) && requested > 0 ? requested : null) : user.id;

  if (type === "tasks") {
    // every task added or completed in the range, as an Excel file
    const params: unknown[] = [from, to];
    let scope = "";
    if (userId) {
      params.push(userId);
      scope = ` AND t.assignee_id = $3`;
    }
    const tasks = await query<Task>(
      `${TASK_SELECT} WHERE (t.created_on BETWEEN $1 AND $2 OR t.completed_on BETWEEN $1 AND $2)${scope}
       ORDER BY t.created_on, t.id`,
      params,
    );
    return xlsxResponse(tasks, `tasks_${from}_to_${to}.xlsx`);
  }

  const logs = await logsBetween(from, to, userId);
  const body = csv([
    ["Date", "Team member", "Hours", "Task", "Project", "Work done"],
    ...[...logs].reverse().map((l) => [l.log_date, l.user_name, l.hours, l.task_title, l.task_project || l.task_category || "Other work", l.note]),
  ]);
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="work-log_${from}_to_${to}.csv"`,
    },
  });
}
