import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMembers, listProjects, listTasks } from "@/lib/data";
import { CATEGORIES, PRIORITIES, STATUSES, isPriority, isStatus } from "@/lib/constants";
import { formatShort, todayStr } from "@/lib/dates";
import { one } from "@/lib/scope";
import { DueLabel, Empty, PageHeader, PriorityLabel } from "@/components/ui";
import { StatusSelect } from "@/components/forms";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const today = todayStr();

  const statusP = one(sp.status) ?? "open";
  const status = statusP === "open" || statusP === "all" || isStatus(statusP) ? statusP : "open";
  const priority = isPriority(one(sp.priority)) ? one(sp.priority) : undefined;
  const category = one(sp.category) || undefined;
  const project = one(sp.project) || undefined;
  const q = (one(sp.q) ?? "").trim().slice(0, 100) || undefined;
  const assigneeParam = Number(one(sp.assignee));
  const assigneeId = isAdmin ? (Number.isInteger(assigneeParam) && assigneeParam > 0 ? assigneeParam : null) : user.id;

  const [tasks, members, projects] = await Promise.all([
    listTasks({ assigneeId, status: status === "all" ? undefined : status, priority, category, project, q }),
    isAdmin ? listMembers() : Promise.resolve([]),
    listProjects(),
  ]);
  const dates = tasks.map((t) => t.created_on).sort();
  const exportFrom = dates[0] ?? today;
  const exportTo = today;
  const currentUrl = `/tasks?${new URLSearchParams(Object.entries({ status, priority, category, project, q, assignee: assigneeId && isAdmin ? String(assigneeId) : undefined }).filter(([, v]) => v) as [string, string][]).toString()}`;

  return (
    <>
      <PageHeader
        title={isAdmin ? "All tasks" : "My tasks"}
        subtitle={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/tasks/import" className="btn-ghost">Import from Excel</Link>
            <a href={`/api/export?type=tasks&from=${exportFrom}&to=${exportTo}${isAdmin && assigneeId ? `&user=${assigneeId}` : ""}`} className="btn-ghost">Export Excel</a>
            <Link href={`/tasks/new?returnTo=${encodeURIComponent(currentUrl)}`} className="btn-primary">+ New task</Link>
          </>
        }
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" method="get">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Search title or details…" />
        </div>
        <div>
          <label className="label" htmlFor="f-status">Status</label>
          <select className="input" id="f-status" name="status" defaultValue={status}>
            <option value="open">Open (not done)</option>
            <option value="all">All</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label className="label" htmlFor="f-assignee">Assigned to</label>
            <select className="input" id="f-assignee" name="assignee" defaultValue={assigneeId ? String(assigneeId) : ""}>
              <option value="">Everyone</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="f-priority">Priority</label>
          <select className="input" id="f-priority" name="priority" defaultValue={priority ?? ""}>
            <option value="">Any</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="max-w-56">
          <label className="label" htmlFor="f-project">Project</label>
          <select className="input" id="f-project" name="project" defaultValue={project ?? ""}>
            <option value="">Any</option>
            {project && !projects.includes(project) && <option value={project}>{project}</option>}
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-category">Category</label>
          <select className="input" id="f-category" name="category" defaultValue={category ?? ""}>
            <option value="">Any</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-ghost">Apply</button>
        <Link href="/tasks" className="btn text-stone-500 hover:text-stone-800">Reset</Link>
      </form>

      <div className="card overflow-hidden">
        {tasks.length === 0 ? (
          <Empty>No tasks match these filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-stone-50/70">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Task</th>
                  {isAdmin && <th className="th">Assigned to</th>}
                  <th className="th">Project / category</th>
                  <th className="th">Priority</th>
                  <th className="th">Due</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/60">
                    <td className="td whitespace-nowrap text-xs text-stone-500">{formatShort(t.created_on)}</td>
                    <td className="td max-w-80">
                      <Link
                        href={`/tasks/${t.id}?returnTo=${encodeURIComponent(currentUrl)}`}
                        className={`block truncate font-medium hover:text-brand-700 ${t.status === "done" ? "text-stone-500 line-through decoration-stone-300" : "text-stone-800"}`}
                      >
                        {t.title}
                      </Link>
                      {(t.status_note || t.description) && (
                        <div className="truncate text-xs text-stone-400">
                          {t.status_note && <span className="italic text-stone-500">{t.status_note} · </span>}
                          {t.description}
                        </div>
                      )}
                    </td>
                    {isAdmin && <td className="td text-stone-600">{t.assignee_name ?? <span className="text-stone-400">Unassigned</span>}</td>}
                    <td className="td max-w-48 truncate text-stone-600" title={t.project || t.category}>{t.project || t.category}</td>
                    <td className="td"><PriorityLabel priority={t.priority} /></td>
                    <td className="td whitespace-nowrap"><DueLabel due={t.due_date} today={today} done={t.status === "done"} /></td>
                    <td className="td"><StatusSelect id={t.id} status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
