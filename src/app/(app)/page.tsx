import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMembers, logsBetween, openTasks, summary } from "@/lib/data";
import { addDays, formatDay, formatLong, todayStr, weekStart } from "@/lib/dates";
import { DayColumns, PageHeader, Section, Stat, hrs } from "@/components/ui";
import { LogList, TaskList } from "@/components/lists";
import { LogWorkForm } from "@/components/forms";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const today = todayStr();
  const ws = weekStart(today);
  const scopeId = isAdmin ? null : user.id;

  const [myOpen, todayLogs, week, members] = await Promise.all([
    openTasks(user.id),
    logsBetween(today, today, scopeId),
    summary(ws, addDays(ws, 6), scopeId, today),
    isAdmin ? listMembers() : Promise.resolve([]),
  ]);
  const myTodayHours = todayLogs.filter((l) => l.user_id === user.id).reduce((s, l) => s + Number(l.hours), 0);
  const notLogged = isAdmin ? members.filter((m) => !todayLogs.some((l) => l.user_id === m.id)) : [];
  const myOverdue = myOpen.filter((t) => t.due_date && t.due_date < today).length;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={formatLong(today)}
        actions={
          <>
            <Link href="/tasks/new?returnTo=/" className="btn-primary">+ New task</Link>
            <Link href="/daily" className="btn-ghost">Add today’s tasks</Link>
            <Link href="/tasks/import" className="btn-ghost">Import Excel</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My hours today" value={hrs(myTodayHours)} hint={myTodayHours === 0 ? "Nothing logged yet" : undefined} tone={myTodayHours === 0 ? "warn" : "default"} />
        <Stat label={isAdmin ? "Team tasks this week" : "My tasks this week"} value={week.tasksTouched} hint={week.hours ? `${hrs(week.hours)} logged` : undefined} />
        <Stat label="Tasks done this week" value={week.completed} tone={week.completed ? "good" : "default"} />
        <Stat label="My open / overdue" value={<>{myOpen.length}<span className="text-base text-stone-400"> / </span><span className={myOverdue ? "text-red-600" : ""}>{myOverdue}</span></>} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Section title="My open tasks" right={<Link href="/tasks?status=open" className="text-xs text-brand-700 hover:underline">All tasks →</Link>}>
            <TaskList tasks={myOpen.slice(0, 12)} today={today} showAssignee={false} empty="No open tasks. Nice work!" />
          </Section>

          <Section title={isAdmin ? "This week · team tasks per day" : "This week · my tasks per day"} right={<Link href="/weekly" className="text-xs text-brand-700 hover:underline">Full summary →</Link>}>
            <DayColumns
              today={today}
              days={week.days.map((d) => ({ ...d, label: formatDay(d.date), href: `/daily?date=${d.date}` }))}
            />
          </Section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Section title="Log today’s work">
            <LogWorkForm date={today} maxDate={today} tasks={myOpen.map((t) => ({ id: t.id, title: t.title }))} />
          </Section>

          {isAdmin && notLogged.length > 0 && (
            <Section title={`Not logged today (${notLogged.length})`}>
              <ul className="flex flex-wrap gap-2 p-4">
                {notLogged.map((m) => (
                  <li key={m.id} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 ring-1 ring-amber-200">{m.name}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={isAdmin ? "Today’s team activity" : "Today’s entries"} right={<Link href="/daily" className="text-xs text-brand-700 hover:underline">Daily view →</Link>}>
            <LogList logs={todayLogs} showUser={isAdmin} canDelete={(l) => isAdmin || l.user_id === user.id} empty="No work logged today yet." />
          </Section>
        </div>
      </div>
    </>
  );
}
