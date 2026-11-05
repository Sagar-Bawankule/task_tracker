import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { summary, type WorkLog } from "@/lib/data";
import { addDays, formatDay, formatLong, formatShort, isDateStr, todayStr, weekStart } from "@/lib/dates";
import { memberOptions, one, resolveScope } from "@/lib/scope";
import { DayColumns, PageHeader, PeriodNav, Section } from "@/components/ui";
import { LogList, TaskList } from "@/components/lists";
import { ParamInput, ParamSelect } from "@/components/forms";
import { CategoryBreakdown, SummaryStats, TeamTable } from "@/components/summary";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Weekly Summary" };

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayStr();
  const d = one(sp.date);
  const from = weekStart(isDateStr(d) ? d : today);
  const to = addDays(from, 6);
  const { userId, members, isAdmin, selected } = await resolveScope(user, sp.user);
  const userQ = selected && isAdmin ? `&user=${selected}` : "";
  const s = await summary(from, to, userId, today);
  const period = `${formatShort(from)} – ${formatShort(to)} ${to.slice(0, 4)}`;
  const who = userId ? members.find((m) => m.id === userId)?.name ?? user.name : "Whole team";

  const logsByDay = new Map<string, WorkLog[]>();
  for (const l of s.logList) logsByDay.set(l.log_date, [...(logsByDay.get(l.log_date) ?? []), l]);

  return (
    <>
      <PageHeader
        title="Weekly summary"
        subtitle={<>{period} · {who}</>}
        actions={
          <>
            {isAdmin && <ParamSelect param="user" value={selected} label="Team member" options={memberOptions(members)} />}
            <PeriodNav
              label="week"
              prevHref={`/weekly?date=${addDays(from, -7)}${userQ}`}
              nextHref={`/weekly?date=${addDays(from, 7)}${userQ}`}
              todayHref={`/weekly?${userQ.slice(1)}`}
              todayLabel="This week"
              picker={<ParamInput param="date" type="date" value={from} label="Pick a day in the week" />}
            />
          </>
        }
      />

      <SummaryStats s={s} workingDays={6} />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Hours per day" className="lg:col-span-3" right={<span className="text-xs text-stone-400">Click a day for details · ✓ = tasks done</span>}>
          <DayColumns today={today} days={s.days.map((x) => ({ ...x, label: `${formatDay(x.date)} ${x.date.slice(8)}`, href: `/daily?date=${x.date}${userQ}` }))} />
        </Section>
        <div className="lg:col-span-2">
          <CategoryBreakdown s={s} />
        </div>
      </div>

      {isAdmin && !userId && (
        <div className="mt-6">
          <TeamTable s={s} period={period} query={`date=${from}`} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title={`Tasks completed (${s.completed})`}>
          <TaskList tasks={s.completedTasks} today={today} showAssignee={!userId} editable={false} showCompleted empty="No tasks completed this week." />
        </Section>
        <Section
          title="Day-by-day work log"
          right={
            <div className="no-print flex gap-2">
              <a href={`/api/export?from=${from}&to=${to}${userQ}`} className="text-xs text-brand-700 hover:underline">Download CSV</a>
              <PrintButton />
            </div>
          }
        >
          {s.days.every((x) => !logsByDay.has(x.date)) ? (
            <LogList logs={[]} canDelete={() => false} empty="No work logged this week." />
          ) : (
            s.days
              .filter((x) => logsByDay.has(x.date))
              .map((x) => (
                <details key={x.date} open={s.days.length <= 7} className="border-b border-stone-100 last:border-0">
                  <summary className="flex cursor-pointer items-center justify-between bg-stone-50/60 px-4 py-2 text-xs font-medium text-stone-600">
                    <Link href={`/daily?date=${x.date}${userQ}`} className="hover:text-brand-700">{formatLong(x.date)}</Link>
                    <span className="tabular-nums">{Math.round(x.hours * 100) / 100}h</span>
                  </summary>
                  <LogList logs={logsByDay.get(x.date)!} showUser={!userId} canDelete={(l) => isAdmin || l.user_id === user.id} />
                </details>
              ))
          )}
        </Section>
      </div>
    </>
  );
}
