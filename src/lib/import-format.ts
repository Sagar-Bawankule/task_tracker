// Shared (browser + server) helpers for spreadsheet import.

export const IMPORT_FIELDS = [
  { key: "date", label: "Date (day the work was done)", synonyms: ["date", "day", "workdate", "taskdate", "createdon", "created", "startdate", "dateadded"] },
  { key: "title", label: "Task title", required: true, synonyms: ["taskrequest", "task", "title", "taskname", "request", "activity", "subject", "work"] },
  { key: "description", label: "What was done / details", synonyms: ["whatwasdone", "workdone", "details", "description", "summary", "taskdetails"] },
  { key: "project", label: "Project", synonyms: ["chatsession", "project", "projectname", "session", "client", "campaign", "brand"] },
  { key: "status", label: "Status", synonyms: ["statusgroup", "status", "state", "progress"] },
  { key: "status_note", label: "Status note", synonyms: ["statusdetail", "statusnote", "statusdetails", "statusremark"] },
  { key: "source", label: "Source", synonyms: ["source", "channel", "tool", "platform"] },
  { key: "output", label: "Output / files", synonyms: ["outputfiles", "output", "files", "deliverable", "deliverables", "file"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "note", "remarks", "remark", "comments", "comment"] },
  { key: "link", label: "Link", synonyms: ["chatlink", "link", "url", "links"] },
  { key: "assignee", label: "Assigned to (name or email)", synonyms: ["assignedto", "assignee", "owner", "employee", "member", "staff", "doneby", "person", "name"] },
  { key: "category", label: "Category / department", synonyms: ["category", "department", "dept", "type"] },
  { key: "priority", label: "Priority", synonyms: ["priority"] },
  { key: "due_date", label: "Due date", synonyms: ["duedate", "due", "deadline", "targetdate"] },
  { key: "completed_on", label: "Completed on", synonyms: ["completedon", "completeddate", "donedate", "completiondate", "completed"] },
  { key: "hours", label: "Hours spent", synonyms: ["hours", "timespent", "hrs", "duration", "hoursspent"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportRow = Partial<Record<ImportField, string>>;

/** A parsed spreadsheet cell: display text plus hyperlink target if any */
export type Cell = { v: string; l?: string };
export type ParsedSheet = { name: string; headers: string[]; rows: Cell[][] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess which column holds each field from the header names. Returns field -> column index. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const n = headers.map(norm);
  const used = new Set<number>();
  const map: Partial<Record<ImportField, number>> = {};
  // a header that exactly names some field (e.g. "Due date") is never used as a loose match for another field
  const exactAny = new Set(n.map((h, i) => (IMPORT_FIELDS.some((f) => (f.synonyms as readonly string[]).includes(h)) ? i : -1)));
  // exact matches first (in synonym priority order), then "contains" matches
  for (const pass of ["exact", "contains"] as const) {
    for (const f of IMPORT_FIELDS) {
      if (map[f.key] !== undefined) continue;
      for (const syn of f.synonyms) {
        const idx = n.findIndex(
          (h, i) =>
            !used.has(i) && h && (pass === "exact" ? h === syn : !exactAny.has(i) && syn.length >= 4 && h.includes(syn)),
        );
        if (idx >= 0) {
          map[f.key] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return map;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function valid(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Reads a date written in common Indian/office formats and returns YYYY-MM-DD.
 * Numeric dates like 05/11/2026 are read as DD/MM/YYYY.
 */
export function parseDateText(input: string | undefined | null): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // 2026-10-12
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); // 12/10/2026 (day first)
  if (m) return valid(+m[3], +m[2], +m[1]) ?? valid(+m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[\s-]+([a-z]{3,})[\s,-]+(\d{2,4})$/i); // 12 Oct 2026
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) return valid(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]);
  m = s.match(/^([a-z]{3,})\s+(\d{1,2}),?\s+(\d{2,4})$/i); // Oct 12, 2026
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) return valid(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Excel serial date number
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

/** Builds import rows from a sheet using a column mapping */
export function mapRows(sheet: ParsedSheet, mapping: Partial<Record<ImportField, number>>): ImportRow[] {
  return sheet.rows.map((cells) => {
    const row: ImportRow = {};
    for (const f of IMPORT_FIELDS) {
      const idx = mapping[f.key];
      if (idx === undefined || idx < 0) continue;
      const c = cells[idx];
      if (!c) continue;
      const v = f.key === "link" ? c.l || c.v : c.v;
      if (v && v.trim()) row[f.key] = v.trim();
    }
    return row;
  });
}
