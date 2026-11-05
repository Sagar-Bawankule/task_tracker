// All dates are handled as "YYYY-MM-DD" strings in the office timezone.

export const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s).getTime());
}

export function isMonthStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Monday of the week containing the date */
export function weekStart(s: string): string {
  const day = parse(s).getUTCDay(); // 0 = Sunday
  return addDays(s, day === 0 ? -6 : 1 - day);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return fmt(new Date(Date.UTC(y, m, 0)));
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return fmt(d).slice(0, 7);
}

export function weekday(s: string): number {
  return parse(s).getUTCDay();
}

export function formatLong(s: string): string {
  return parse(s).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShort(s: string): string {
  return parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatDay(s: string): string {
  return parse(s).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

export function formatMonth(month: string): string {
  return parse(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
