import Link from "next/link";
import type { Summary } from "@/lib/data";
import { BarList, Empty, Section, Stat, hrs } from "./ui";

export function SummaryStats({ s, workingDays }: { s: Summary; workingDays: number }) {
  const activeDays = s.days.filter((d) => d.hours > 0).length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat label="Hours logged" value={hrs(s.hours)} hint={`${s.logs} work entries`} />
      <Stat
        label="Avg hours / active day"
        value={activeDays ? hrs(s.hours / activeDays) : "–"}
        hint={`${activeDays} of ${workingDays} days with entries`}
      />
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
                <th className="th text-right">Hours</th>
                <th className="th text-right">Days logged</th>
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
                  <td className={`td text-right tabular-nums ${p.hours === 0 ? "text-red-500" : ""}`}>{hrs(p.hours)}</td>
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

export function CategoryBreakdown({ s }: { s: Summary }) {
  return (
    <Section title="Time by category">
      {s.categories.length === 0 ? (
        <Empty>Nothing logged in this period.</Empty>
      ) : (
        <BarList
          format={hrs}
          items={s.categories.map((c) => ({
            label: c.category,
            value: c.hours,
            sub: c.completed ? `✓ ${c.completed}` : undefined,
          }))}
        />
      )}
    </Section>
  );
}
