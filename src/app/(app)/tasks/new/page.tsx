import { requireUser } from "@/lib/auth";
import { listMembers } from "@/lib/data";
import { isDateStr } from "@/lib/dates";
import { one } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const members = await listMembers();
  const r = one(sp.returnTo) ?? "/tasks";
  const returnTo = r.startsWith("/") && !r.startsWith("//") ? r : "/tasks";
  const due = one(sp.due);

  return (
    <>
      <PageHeader title="New task" />
      <div className="card max-w-2xl">
        <TaskForm members={members} currentUserId={user.id} isAdmin={user.role === "admin"} returnTo={returnTo} defaultDue={isDateStr(due) ? due : undefined} />
      </div>
    </>
  );
}
