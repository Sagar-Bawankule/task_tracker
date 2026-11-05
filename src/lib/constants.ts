export const STATUSES = [
  { value: "todo", label: "To Do", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  { value: "in_progress", label: "In Progress", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "review", label: "In Review", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "blocked", label: "On Hold", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  { value: "done", label: "Done", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Low", cls: "text-slate-500" },
  { value: "medium", label: "Medium", cls: "text-sky-700" },
  { value: "high", label: "High", cls: "text-orange-600" },
  { value: "urgent", label: "Urgent", cls: "text-red-600 font-semibold" },
] as const;

export const CATEGORIES = [
  "General",
  "Sales",
  "Marketing",
  "Social Media",
  "Orders & Dispatch",
  "Inventory",
  "Customer Service",
  "Accounts",
  "Design",
  "Purchase",
  "HR & Admin",
];

export type Status = (typeof STATUSES)[number]["value"];
export type Priority = (typeof PRIORITIES)[number]["value"];

export const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
export const priorityMeta = (p: string) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];
export const isStatus = (s: unknown): s is Status => STATUSES.some((x) => x.value === s);
export const isPriority = (p: unknown): p is Priority => PRIORITIES.some((x) => x.value === p);

/**
 * Turns free-text status from a spreadsheet ("Live", "Prototype (awaiting approval)",
 * "Pending", "Answered"…) into one of the app's statuses.
 */
export function statusFromText(text: string): Status {
  const t = text.trim().toLowerCase();
  if (!t) return "done";
  if (STATUSES.some((s) => s.value === t)) return t as Status;
  const byLabel = STATUSES.find((s) => s.label.toLowerCase() === t);
  if (byLabel) return byLabel.value;
  if (/not started|to ?do|^new|^open/.test(t)) return "todo";
  if (/hold|blocked|waiting/.test(t)) return "blocked";
  if (/pending|incomplete|not finished|in progress|ongoing|wip|partial/.test(t)) return "in_progress";
  if (/draft|prototype|review|approval|testing|staging/.test(t)) return "review";
  if (/done|live|complete|finished|answered|prompt given|delivered|published|closed|approved|sent/.test(t)) return "done";
  return "in_progress";
}

/** Removes leading session ids like "ad7a9a73 · " or "904ee763 (+d08e3949) · " from a project name */
export function cleanProject(text: string): string {
  const s = text.trim();
  const m = s.match(/^([0-9a-f]{6,}[0-9a-f\s/+(),]*?)\s*[·•—–:|-]\s*(.+)$/i);
  return (m ? m[2] : s).slice(0, 120);
}
