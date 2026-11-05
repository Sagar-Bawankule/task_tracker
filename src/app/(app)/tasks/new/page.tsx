import { requireUser } from "@/lib/auth";
import { listMembers, listProjects } from "@/lib/data";
import { isDateStr, todayStr } from "@/lib/dates";
import { one } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [members, projects] = await Promise.all([listMembers(), listProjects()]);
  const today = todayStr();
  const dd = one(sp.date);
  const r = one(sp.returnTo) ?? "/tasks";
  const returnTo = r.startsWith("/") && !r.startsWith("//") ? r : "/tasks";
  const due = one(sp.due);

  return (
    <>
      <PageHeader title="New task" />
      <div className="card max-w-2xl">
        <TaskForm members={members} currentUserId={user.id} isAdmin={user.role === "admin"} returnTo={returnTo} defaultDue={isDateStr(due) ? due : undefined} projects={projects} today={today} defaultDate={isDateStr(dd) && dd <= today ? dd : undefined} />
      </div>
    </>
  );
}
