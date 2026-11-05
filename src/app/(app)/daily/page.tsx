import { requireUser } from "@/lib/auth";
import { listTasks, logsBetween, openTasks, tasksCompletedBetween, type WorkLog } from "@/lib/data";
import { addDays, formatLong, isDateStr, todayStr } from "@/lib/dates";
import { memberOptions, one, resolveScope } from "@/lib/scope";
import { BarList, PageHeader, PeriodNav, Section, Stat, hrs } from "@/components/ui";
import { LogList, TaskList } from "@/components/lists";
import { LogWorkForm, ParamInput, ParamSelect } from "@/components/forms";

export const metadata = { title: "Daily" };

export default async function DailyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayStr();
  const d = one(sp.date);
  const date = isDateStr(d) ? d : today;
  const { userId, members, isAdmin, selected } = await resolveScope(user, sp.user);
  const userQ = selected && isAdmin ? `&user=${selected}` : "";

  const [logs, completed, dueThatDay, myOpen] = await Promise.all([
    logsBetween(date, date, userId),
    tasksCompletedBetween(date, date, userId),
    listTasks({ assigneeId: userId }).then((ts) => ts.filter((t) => t.due_date === date)),
    openTasks(user.id),
  ]);
  const hours = logs.reduce((s, l) => s + Number(l.hours), 0);
  const peopleLogged = new Set(logs.map((l) => l.user_id));

  const byPerson = new Map<number, { name: string; logs: WorkLog[]; hours: number }>();
  for (const l of logs) {
    const p = byPerson.get(l.user_id) ?? { name: l.user_name, logs: [], hours: 0 };
    p.logs.push(l);
    p.hours += Number(l.hours);
    byPerson.set(l.user_id, p);
  }
  const showTeam = isAdmin && !userId;

  return (
    <>
      <PageHeader
        title="Daily report"
        subtitle={<>{formatLong(date)}{date === today && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Today</span>}</>}
        actions={
          <>
            {isAdmin && <ParamSelect param="user" value={selected} label="Team member" options={memberOptions(members)} />}
            <PeriodNav
              label="day"
              prevHref={`/daily?date=${addDays(date, -1)}${userQ}`}
              nextHref={`/daily?date=${addDays(date, 1)}${userQ}`}
              todayHref={`/daily?${userQ.slice(1)}`}
              todayLabel="Today"
              picker={<ParamInput param="date" type="date" value={date} label="Pick date" />}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hours logged" value={hrs(hours)} hint={`${logs.length} entries`} />
        <Stat label="Tasks completed" value={completed.length} tone={completed.length ? "good" : "default"} />
        <Stat label="Tasks due this day" value={dueThatDay.length} hint={`${dueThatDay.filter((t) => t.status !== "done").length} still open`} />
        {showTeam ? (
          <Stat label="Members who logged" value={`${peopleLogged.size} / ${members.length}`} tone={peopleLogged.size < members.length ? "warn" : "good"} />
        ) : (
          <Stat label="Entries" value={logs.length} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {showTeam ? (
            <>
              <Section title="Hours by team member">
                <BarList
                  format={hrs}
                  items={members.map((m) => ({
                    label: m.name,
                    value: byPerson.get(m.id)?.hours ?? 0,
                    sub: byPerson.has(m.id) ? undefined : <span className="text-amber-700">not logged</span>,
                  }))}
                />
              </Section>
              {[...byPerson.entries()].map(([id, p]) => (
                <Section key={id} title={p.name} right={<span className="text-sm font-semibold tabular-nums text-brand-700">{hrs(p.hours)}</span>}>
                  <LogList logs={p.logs} showUser={false} canDelete={() => true} />
                </Section>
              ))}
              {byPerson.size === 0 && (
                <Section title="Work log">
                  <LogList logs={[]} canDelete={() => false} empty="Nobody has logged work for this day." />
                </Section>
              )}
            </>
          ) : (
            <Section title="Work log" right={<span className="text-sm font-semibold tabular-nums text-brand-700">{hrs(hours)}</span>}>
              <LogList logs={logs} showUser={isAdmin} canDelete={(l) => isAdmin || l.user_id === user.id} empty="No work logged for this day." />
            </Section>
          )}

          <Section title={`Completed on this day (${completed.length})`}>
            <TaskList tasks={completed} today={today} showAssignee={!userId || isAdmin} showCompleted empty="No tasks completed." />
          </Section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {date <= today && (
            <Section title={date === today ? "Log work for today" : "Add a missed entry"}>
              <LogWorkForm
                date={date}
                maxDate={today}
                tasks={myOpen.map((t) => ({ id: t.id, title: t.title }))}
                members={isAdmin ? members : undefined}
              />
            </Section>
          )}
          <Section title={`Due on this day (${dueThatDay.length})`}>
            <TaskList tasks={dueThatDay} today={today} showAssignee={isAdmin} empty="Nothing due." />
          </Section>
        </div>
      </div>
    </>
  );
}
