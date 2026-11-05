import Link from "next/link";
import { priorityMeta, statusMeta } from "@/lib/constants";
import { formatShort } from "@/lib/dates";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const color = { default: "text-stone-900", good: "text-emerald-700", warn: "text-amber-700", bad: "text-red-600" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}

export function Section({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-stone-400">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: string }) {
  const m = priorityMeta(priority);
  return <span className={`text-xs ${m.cls}`}>{m.label}</span>;
}

export function DueLabel({ due, today, done }: { due: string | null; today: string; done?: boolean }) {
  if (!due) return <span className="text-xs text-stone-400">No due date</span>;
  if (!done && due < today) return <span className="text-xs font-medium text-red-600">Overdue · {formatShort(due)}</span>;
  if (!done && due === today) return <span className="text-xs font-medium text-amber-700">Due today</span>;
  return <span className="text-xs text-stone-500">Due {formatShort(due)}</span>;
}

export function hrs(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2).replace(/0$/, "")}h`;
}

export function PeriodNav({
  prevHref,
  nextHref,
  todayHref,
  label,
  todayLabel,
  picker,
}: {
  prevHref: string;
  nextHref: string;
  todayHref: string;
  label: string;
  todayLabel: string;
  picker?: React.ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-stone-300 bg-white">
        <Link href={prevHref} className="px-3 py-2 text-sm text-stone-600 hover:bg-stone-50" aria-label={`Previous ${label}`}>
          ←
        </Link>
        <Link href={todayHref} className="border-x border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          {todayLabel}
        </Link>
        <Link href={nextHref} className="px-3 py-2 text-sm text-stone-600 hover:bg-stone-50" aria-label={`Next ${label}`}>
          →
        </Link>
      </div>
      {picker}
    </div>
  );
}

/** Simple horizontal bar list */
export function BarList({
  items,
  format = (n) => String(n),
}: {
  items: { label: React.ReactNode; value: number; sub?: React.ReactNode }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5 p-4">
      {items.map((i, idx) => (
        <li key={idx}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-stone-700">{i.label}</span>
            <span className="shrink-0 tabular-nums text-stone-500">
              {format(i.value)}
              {i.sub && <span className="ml-2 text-xs text-stone-400">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-brand-400" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical column chart for per-day values */
export function DayColumns({
  days,
  today,
}: {
  days: { date: string; label: string; hours: number; completed: number; href: string }[];
  today: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.hours));
  return (
    <div className="p-4">
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {days.map((d) => (
          <Link
            key={d.date}
            href={d.href}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${d.date}: ${hrs(d.hours)} logged, ${d.completed} tasks done`}
          >
            <span className="mb-1 text-[11px] tabular-nums text-stone-500">{d.hours > 0 ? hrs(d.hours) : ""}</span>
            <div
              className={`w-full max-w-12 rounded-t-md transition group-hover:opacity-80 ${
                d.date === today ? "bg-brand-600" : "bg-brand-300"
              }`}
              style={{ height: `${Math.max(d.hours > 0 ? 4 : 0, (d.hours / max) * 100)}%` }}
            />
          </Link>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-stone-100 pt-2 sm:gap-2">
        {days.map((d) => (
          <div key={d.date} className="min-w-0 flex-1 text-center">
            <div className={`truncate text-[11px] ${d.date === today ? "font-semibold text-brand-700" : "text-stone-500"}`}>
              {d.label}
            </div>
            <div className="text-[11px] text-emerald-700">{d.completed > 0 ? `✓${d.completed}` : " "}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
