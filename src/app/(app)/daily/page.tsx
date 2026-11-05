import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listProjects, listTasks, logsBetween, openTasks, tasksOnDay, type Task, type WorkLog } from "@/lib/data";
import { addDays, formatLong, isDateStr, todayStr } from "@/lib/dates";
import { memberOptions, one, resolveScope } from "@/lib/scope";
import { BarList, PageHeader, PeriodNav, Section, Stat, hrs } from "@/components/ui";
import { LogList, TaskList } from "@/components/lists";
import { LogWorkForm, ParamInput, ParamSelect } from "@/components/forms";
import { DayTasksForm } from "@/components/day-tasks-form";

export const metadata = { title: "Daily" };

export default async function DailyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayStr();
  const d = one(sp.date);
  const date = isDateStr(d) ? d : today;
  const { userId, members, isAdmin, selected } = await resolveScope(user, sp.user);
  const userQ = selected && isAdmin ? `&user=${selected}` : "";

  const [logs, dayTasks, dueThatDay, myOpen, projects] = await Promise.all([
    logsBetween(date, date, userId),
    tasksOnDay(date, userId),
    listTasks({ assigneeId: userId }).then((ts) => ts.filter((t) => t.due_date === date)),
    openTasks(user.id),
    listProjects(),
  ]);
  const hours = logs.reduce((s, l) => s + Number(l.hours), 0);
  const completed = dayTasks.filter((t) => t.status === "done" && t.completed_on === date);
  const peopleActive = new Set([...logs.map((l) => l.user_id), ...dayTasks.map((t) => t.assignee_id).filter(Boolean)]);

  // tasks grouped by project
  const groups = new Map<string, Task[]>();
  for (const t of dayTasks) {
    const g = t.project || "No project";
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const groupList = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const byPerson = new Map<number, { name: string; logs: WorkLog[]; hours: number }>();
  for (const l of logs) {
    const p = byPerson.get(l.user_id) ?? { name: l.user_name, logs: [], hours: 0 };
    p.logs.push(l);
    p.hours += Number(l.hours);
    byPerson.set(l.user_id, p);
  }
  const showTeam = isAdmin && !userId;
  const tasksPerPerson = new Map<number, number>();
  for (const t of dayTasks) if (t.assignee_id) tasksPerPerson.set(t.assignee_id, (tasksPerPerson.get(t.assignee_id) ?? 0) + 1);

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
        <Stat label="Tasks on this day" value={dayTasks.length} hint={`${groups.size} project${groups.size === 1 ? "" : "s"}`} />
        <Stat label="Completed" value={completed.length} tone={completed.length ? "good" : "default"} hint={`${dayTasks.length - completed.length} other status`} />
        <Stat label="Hours logged" value={hrs(hours)} hint={`${logs.length} entries`} />
        {showTeam ? (
          <Stat label="Members active" value={`${peopleActive.size} / ${members.length}`} tone={peopleActive.size < members.length ? "warn" : "good"} />
        ) : (
          <Stat label="Due this day" value={dueThatDay.length} hint={`${dueThatDay.filter((t) => t.status !== "done").length} still open`} />
        )}
      </div>

      {date <= today && (
        <details className="card no-print mt-6 overflow-hidden" open={dayTasks.length === 0}>
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50">
            <span>+ Add several tasks for this day</span>
            <span className="text-xs font-normal text-stone-400">
              or <Link href="/tasks/import" className="text-brand-700 hover:underline">import from Excel</Link>
            </span>
          </summary>
          <div className="border-t border-stone-100">
            <DayTasksForm date={date} projects={projects} members={isAdmin ? members : undefined} />
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {groupList.length === 0 ? (
            <Section title="Tasks on this day">
              <TaskList tasks={[]} today={today} empty="No tasks added or completed on this day." />
            </Section>
          ) : (
            groupList.map(([project, ts]) => (
              <Section
                key={project}
                title={project}
                right={
                  <span className="text-xs text-stone-500">
                    {ts.length} task{ts.length === 1 ? "" : "s"}
                    {project !== "No project" && (
                      <Link href={`/tasks?status=all&project=${encodeURIComponent(project)}`} className="ml-2 text-brand-700 hover:underline">all →</Link>
                    )}
                  </span>
                }
              >
                <TaskList tasks={ts} today={today} showAssignee={showTeam} showProject={false} showCompleted />
              </Section>
            ))
          )}

          {(logs.length > 0 || showTeam) && (
            <Section title="Hours logged" right={<span className="text-sm font-semibold tabular-nums text-brand-700">{hrs(hours)}</span>}>
              {showTeam && (
                <BarList
                  format={hrs}
                  items={members.map((m) => ({
                    label: m.name,
                    value: byPerson.get(m.id)?.hours ?? 0,
                    sub: tasksPerPerson.get(m.id) ? `${tasksPerPerson.get(m.id)} tasks` : byPerson.has(m.id) ? undefined : <span className="text-amber-700">no entries</span>,
                  }))}
                />
              )}
              <div className={showTeam ? "border-t border-stone-100" : ""}>
                <LogList logs={logs} showUser={isAdmin} canDelete={(l) => isAdmin || l.user_id === user.id} empty="No hours logged for this day." />
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {date <= today && (
            <Section title="Log hours">
              <LogWorkForm date={date} maxDate={today} tasks={myOpen.map((t) => ({ id: t.id, title: t.title }))} members={isAdmin ? members : undefined} />
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
