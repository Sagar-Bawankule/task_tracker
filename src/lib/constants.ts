export const STATUSES = [
  { value: "todo", label: "To Do", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  { value: "in_progress", label: "In Progress", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
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
