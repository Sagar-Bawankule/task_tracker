import Link from "next/link";
import { saveTask } from "@/lib/actions";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/constants";
import type { Member, Task } from "@/lib/data";

export function TaskForm({
  task,
  members,
  currentUserId,
  isAdmin,
  returnTo,
  defaultDue,
  defaultDate,
  projects,
  today,
}: {
  task?: Task;
  members: Member[];
  currentUserId: number;
  isAdmin: boolean;
  returnTo: string;
  defaultDue?: string;
  defaultDate?: string;
  projects: string[];
  today: string;
}) {
  const assignable = isAdmin ? members : members.filter((m) => m.id === currentUserId || m.id === task?.assignee_id);
  return (
    <form action={saveTask} className="space-y-4 p-5">
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label className="label" htmlFor="title">Task title</label>
        <input className="input" id="title" name="title" required defaultValue={task?.title} placeholder="e.g. Prepare Diwali offer posts for Instagram" autoFocus={!task} />
      </div>
      <div>
        <label className="label" htmlFor="description">What was done / details</label>
        <textarea className="input min-h-24" id="description" name="description" defaultValue={task?.description} placeholder="Notes, links, quantities…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="assignee_id">Assigned to</label>
          <select className="input" id="assignee_id" name="assignee_id" defaultValue={String(task?.assignee_id ?? currentUserId)}>
            {isAdmin && <option value="">Unassigned</option>}
            {assignable.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.department ? ` (${m.department})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input className="input" id="category" name="category" list="categories" defaultValue={task?.category ?? "General"} />
          <datalist id="categories">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="priority">Priority</label>
          <select className="input" id="priority" name="priority" defaultValue={task?.priority ?? "medium"}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={task?.status ?? "todo"}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="due_date">Due date</label>
          <input className="input" id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? defaultDue ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="project">Project</label>
          <input className="input" id="project" name="project" list="projects" defaultValue={task?.project ?? ""} placeholder="e.g. Shop the Look section" />
          <datalist id="projects">
            {projects.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="work_date">Date (day of the work)</label>
          <input className="input" id="work_date" name="work_date" type="date" max={today} defaultValue={task?.created_on ?? defaultDate ?? today} />
        </div>
        <div>
          <label className="label" htmlFor="status_note">Status note</label>
          <input className="input" id="status_note" name="status_note" defaultValue={task?.status_note ?? ""} placeholder="e.g. Live, Awaiting approval" />
        </div>
        <div>
          <label className="label" htmlFor="completed_on">Completed on (if done)</label>
          <input className="input" id="completed_on" name="completed_on" type="date" max={today} defaultValue={task?.completed_on ?? ""} />
        </div>
      </div>
      <details className="rounded-lg border border-stone-200" open={!!(task?.output || task?.notes || task?.link || task?.source)}>
        <summary className="cursor-pointer px-3 py-2 text-sm text-stone-600">More details: output files, link, notes</summary>
        <div className="grid gap-4 border-t border-stone-100 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="output">Output / files</label>
            <input className="input" id="output" name="output" defaultValue={task?.output ?? ""} placeholder="File names, folders, theme IDs…" />
          </div>
          <div>
            <label className="label" htmlFor="link">Link</label>
            <input className="input" id="link" name="link" type="url" defaultValue={task?.link ?? ""} placeholder="https://…" />
          </div>
          <div>
            <label className="label" htmlFor="source">Source</label>
            <input className="input" id="source" name="source" defaultValue={task?.source ?? ""} placeholder="e.g. Code, Chat, Email" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notes</label>
            <textarea className="input min-h-16" id="notes" name="notes" defaultValue={task?.notes ?? ""} />
          </div>
        </div>
      </details>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary">{task ? "Save changes" : "Create task"}</button>
        <Link href={returnTo} className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
