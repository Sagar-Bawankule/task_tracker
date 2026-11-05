import Link from "next/link";
import type { Summary } from "@/lib/data";
import { BarList, Empty, Section, Stat, hrs } from "./ui";

export function SummaryStats({ s, workingDays }: { s: Summary; workingDays: number }) {
  const activeDays = s.days.filter((d) => d.tasks > 0 || d.hours > 0).length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat
        label="Tasks worked on"
        value={s.tasksTouched}
        hint={`${activeDays} of ${workingDays} days active${activeDays ? ` · avg ${Math.round((s.tasksTouched / activeDays) * 10) / 10}/day` : ""}`}
      />
      <Stat label="Hours logged" value={hrs(s.hours)} hint={`${s.logs} work entries`} />
      <Stat label="Tasks completed" value={s.completed} tone={s.completed ? "good" : "default"} hint={`${s.created} new tasks created`} />
      <Stat label="Open tasks (now)" value={s.openNow} />
      <Stat label="Overdue (now)" value={s.overdueNow} tone={s.overdueNow ? "bad" : "default"} />
    </div>
  );
}

export function TeamTable({ s, period, query }: { s: Summary; period: string; query: string }) {
  return (
    <Section title={`Team summary · ${period}`}>
      {s.people.length === 0 ? (
        <Empty>No team members yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="bg-stone-50/70">
              <tr>
                <th className="th">Member</th>
                <th className="th text-right">Tasks</th>
                <th className="th text-right">Hours</th>
                <th className="th text-right">Active days</th>
                <th className="th text-right">Tasks done</th>
                <th className="th text-right">Open</th>
                <th className="th text-right">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {s.people.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/60">
                  <td className="td font-medium text-stone-800">
                    <Link href={`?${query}&user=${p.id}`} className="hover:text-brand-700">{p.name}</Link>
                  </td>
                  <td className={`td text-right font-medium tabular-nums ${p.tasks === 0 && p.hours === 0 ? "text-red-500" : ""}`}>{p.tasks}</td>
                  <td className="td text-right tabular-nums text-stone-600">{hrs(p.hours)}</td>
                  <td className="td text-right tabular-nums">{p.daysLogged}</td>
                  <td className="td text-right tabular-nums text-emerald-700">{p.completed}</td>
                  <td className="td text-right tabular-nums">{p.open}</td>
                  <td className={`td text-right tabular-nums ${p.overdue ? "font-medium text-red-600" : ""}`}>{p.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function CategoryBreakdown({ s, limit = 12 }: { s: Summary; limit?: number }) {
  const rows = s.categories.slice(0, limit);
  return (
    <Section title="Work by project" right={s.categories.length > limit ? <span className="text-xs text-stone-400">top {limit} of {s.categories.length}</span> : undefined}>
      {rows.length === 0 ? (
        <Empty>Nothing in this period.</Empty>
      ) : (
        <BarList
          format={(n) => `${n} task${n === 1 ? "" : "s"}`}
          items={rows.map((c) => ({
            label: (
              <a href={`/tasks?status=all&project=${encodeURIComponent(c.category)}`} className="hover:text-brand-700">
                {c.category}
              </a>
            ),
            value: c.tasks,
            sub: [c.completed ? `✓ ${c.completed}` : "", c.hours ? hrs(c.hours) : ""].filter(Boolean).join(" · ") || undefined,
          }))}
        />
      )}
    </Section>
  );
}
