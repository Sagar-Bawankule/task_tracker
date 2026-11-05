import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getTask, listMembers, type WorkLog } from "@/lib/data";
import { deleteTask } from "@/lib/actions";
import { formatShort } from "@/lib/dates";
import { one } from "@/lib/scope";
import { PageHeader, Section, StatusBadge, hrs } from "@/components/ui";
import { LogList } from "@/components/lists";
import { TaskForm } from "@/components/task-form";

export const metadata = { title: "Task" };

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) notFound();
  const task = await getTask(taskId);
  if (!task) notFound();

  const isAdmin = user.role === "admin";
  const creator = await queryOne<{ created_by: number | null }>("SELECT created_by FROM tasks WHERE id = $1", [taskId]);
  const canEdit = isAdmin || task.assignee_id === user.id || creator?.created_by === user.id;
  if (!canEdit) notFound();

  const [members, logs] = await Promise.all([
    listMembers(true),
    query<WorkLog>(
      `SELECT l.id, l.user_id, u.name AS user_name, l.task_id, NULL AS task_title, NULL AS task_category, l.log_date, l.hours, l.note
       FROM work_logs l JOIN users u ON u.id = l.user_id WHERE l.task_id = $1 ORDER BY l.log_date DESC, l.id DESC`,
      [taskId],
    ),
  ]);
  const r = one(sp.returnTo) ?? "/tasks";
  const returnTo = r.startsWith("/") && !r.startsWith("//") ? r : "/tasks";
  const total = logs.reduce((s, l) => s + Number(l.hours), 0);

  return (
    <>
      <PageHeader
        title="Edit task"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            Created {formatShort(task.created_on)}
            {task.created_by_name && <> by {task.created_by_name}</>}
            {task.completed_on && <> · Completed {formatShort(task.completed_on)}</>}
          </span>
        }
        actions={
          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="btn-danger">Delete task</button>
          </form>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <TaskForm task={task} members={members.filter((m) => m.active || m.id === task.assignee_id)} currentUserId={user.id} isAdmin={isAdmin} returnTo={returnTo} />
        </div>
        <Section title="Time spent on this task" className="h-fit lg:col-span-2" right={<span className="text-sm font-semibold text-brand-700">{hrs(total)}</span>}>
          <LogList logs={logs} showDate canDelete={(l) => isAdmin || l.user_id === user.id} empty="No work logged against this task yet." />
        </Section>
      </div>
    </>
  );
}
