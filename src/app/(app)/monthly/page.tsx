import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { summary } from "@/lib/data";
import { addDays, addMonths, formatMonth, formatShort, isMonthStr, monthEnd, monthStart, todayStr, weekStart, weekday } from "@/lib/dates";
import { memberOptions, one, resolveScope } from "@/lib/scope";
import { PageHeader, PeriodNav, Section, hrs } from "@/components/ui";
import { TaskList } from "@/components/lists";
import { ParamInput, ParamSelect } from "@/components/forms";
import { CategoryBreakdown, SummaryStats, TeamTable } from "@/components/summary";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Monthly" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayStr();
  const m = one(sp.month);
  const month = isMonthStr(m) ? m : today.slice(0, 7);
  const from = monthStart(month);
  const to = monthEnd(month);
  const { userId, members, isAdmin, selected } = await resolveScope(user, sp.user);
  const userQ = selected && isAdmin ? `&user=${selected}` : "";
  const s = await summary(from, to, userId, today);
  const who = userId ? members.find((x) => x.id === userId)?.name ?? user.name : "Whole team";

  // Calendar cells (Mon-first), padded with blanks
  const lead = (weekday(from) + 6) % 7;
  const cells: (typeof s.days[number] | null)[] = [...Array(lead).fill(null), ...s.days];
  while (cells.length % 7) cells.push(null);
  const maxTasks = Math.max(1, ...s.days.map((d) => d.tasks));

  // Week-by-week breakdown (weeks starting Monday, clipped to the month)
  const weeks: { start: string; from: string; to: string; hours: number; completed: number; logs: number; tasks: number }[] = [];
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
    const wf = ws < from ? from : ws;
    const we = addDays(ws, 6) > to ? to : addDays(ws, 6);
    const ds = s.days.filter((d) => d.date >= wf && d.date <= we);
    weeks.push({
      start: ws,
      from: wf,
      to: we,
      hours: ds.reduce((a, d) => a + d.hours, 0),
      completed: ds.reduce((a, d) => a + d.completed, 0),
      logs: ds.reduce((a, d) => a + d.logs, 0),
      tasks: new Set(
        s.touchedTasks
          .filter((t) => (t.created_on >= wf && t.created_on <= we) || (t.completed_on && t.completed_on >= wf && t.completed_on <= we))
          .map((t) => t.id),
      ).size,
    });
  }
  const workingDays = s.days.filter((d) => weekday(d.date) !== 0 && d.date <= today).length;

  return (
    <>
      <PageHeader
        title="Monthly report"
        subtitle={<>{formatMonth(month)} · {who}</>}
        actions={
          <>
            {isAdmin && <ParamSelect param="user" value={selected} label="Team member" options={memberOptions(members)} />}
            <PeriodNav
              label="month"
              prevHref={`/monthly?month=${addMonths(month, -1)}${userQ}`}
              nextHref={`/monthly?month=${addMonths(month, 1)}${userQ}`}
              todayHref={`/monthly?${userQ.slice(1)}`}
              todayLabel="This month"
              picker={<ParamInput param="month" type="month" value={month} label="Pick month" />}
            />
          </>
        }
      />

      <SummaryStats s={s} workingDays={Math.max(workingDays, 0)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="Calendar" className="lg:col-span-2" right={<span className="text-xs text-stone-400">Number = tasks · darker = busier</span>}>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-center text-[11px] font-medium uppercase text-stone-400">{w}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} />;
                const intensity = d.tasks / maxTasks;
                const future = d.date > today;
                const sunday = weekday(d.date) === 0;
                return (
                  <Link
                    key={d.date}
                    href={`/daily?date=${d.date}${userQ}`}
                    className={`relative flex aspect-square flex-col rounded-lg border p-1 text-left transition hover:ring-2 hover:ring-brand-300 sm:aspect-auto sm:min-h-20 sm:p-2 ${
                      d.date === today ? "border-brand-500" : "border-stone-200"
                    } ${future ? "bg-stone-50/50" : ""}`}
                    style={d.tasks > 0 ? { backgroundColor: `rgba(217, 68, 120, ${0.08 + intensity * 0.42})` } : undefined}
                  >
                    <span className={`text-xs ${d.date === today ? "font-bold text-brand-700" : sunday ? "text-stone-400" : "text-stone-600"}`}>
                      {Number(d.date.slice(8))}
                    </span>
                    {d.tasks > 0 && (
                      <span className="mt-auto text-[11px] font-semibold tabular-nums text-stone-800 sm:text-sm">
                        {d.tasks}<span className="hidden font-normal sm:inline"> task{d.tasks === 1 ? "" : "s"}</span>
                      </span>
                    )}
                    {d.hours > 0 && <span className="hidden text-[10px] tabular-nums text-stone-600 sm:inline sm:text-xs">{hrs(d.hours)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Week by week">
          <ul className="divide-y divide-stone-100">
            {weeks.map((w, i) => (
              <li key={w.start}>
                <Link href={`/weekly?date=${w.start}${userQ}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="text-sm font-medium text-stone-800">Week {i + 1}</div>
                    <div className="text-xs text-stone-500">{formatShort(w.from)} – {formatShort(w.to)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-brand-700">{w.tasks} tasks</div>
                    <div className="text-xs text-stone-500">
                      <span className="text-emerald-700">✓ {w.completed} done</span>
                      {w.hours > 0 && <> · {hrs(w.hours)}</>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {isAdmin && !userId && (
        <div className="mt-6">
          <TeamTable s={s} period={formatMonth(month)} query={`month=${month}`} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown s={s} />
        <Section
          title={`Tasks completed (${s.completed})`}
          right={
            <div className="no-print flex gap-3">
              <a href={`/api/export?type=tasks&from=${from}&to=${to}${userQ}`} className="text-xs text-brand-700 hover:underline">Tasks Excel</a>
              {s.logs > 0 && <a href={`/api/export?from=${from}&to=${to}${userQ}`} className="text-xs text-brand-700 hover:underline">Hours CSV</a>}
              <PrintButton />
            </div>
          }
        >
          <div className="max-h-[480px] overflow-y-auto">
            <TaskList tasks={s.completedTasks} today={today} showAssignee={!userId} editable={false} showCompleted empty="No tasks completed this month." />
          </div>
        </Section>
      </div>
    </>
  );
}
