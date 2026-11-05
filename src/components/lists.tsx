import Link from "next/link";
import type { Task, WorkLog } from "@/lib/data";
import { deleteLog } from "@/lib/actions";
import { formatShort } from "@/lib/dates";
import { DueLabel, Empty, PriorityLabel, StatusBadge, hrs } from "./ui";
import { StatusSelect } from "./forms";

export function TaskList({
  tasks,
  today,
  showAssignee = true,
  editable = true,
  empty = "No tasks.",
  showCompleted = false,
  showProject = true,
}: {
  tasks: Task[];
  today: string;
  showAssignee?: boolean;
  editable?: boolean;
  empty?: string;
  showCompleted?: boolean;
  showProject?: boolean;
}) {
  if (!tasks.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-stone-100">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/tasks/${t.id}`}
              className={`block truncate text-sm font-medium hover:text-brand-700 ${
                t.status === "done" ? "text-stone-500 line-through decoration-stone-300" : "text-stone-800"
              }`}
            >
              {t.title}
            </Link>
            {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{t.description}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
              {t.priority !== "medium" && <PriorityLabel priority={t.priority} />}
              {showProject && t.project ? (
                <span className="rounded bg-stone-100 px-1.5 py-px text-stone-600">{t.project}</span>
              ) : (
                !t.project && t.category !== "General" && <span>{t.category}</span>
              )}
              {showAssignee && <span>{t.assignee_name ?? "Unassigned"}</span>}
              {t.status_note && <span className="italic text-stone-500">{t.status_note}</span>}
              {showCompleted && t.completed_on ? (
                <span className="text-emerald-700">Done {formatShort(t.completed_on)}</span>
              ) : (
                t.due_date && <DueLabel due={t.due_date} today={today} done={t.status === "done"} />
              )}
              {t.link && (
                <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                  Open link ↗
                </a>
              )}
            </div>
          </div>
          <div className="no-print shrink-0">
            {editable ? <StatusSelect id={t.id} status={t.status} /> : <StatusBadge status={t.status} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LogList({
  logs,
  showUser = true,
  showDate = false,
  canDelete,
  empty = "No work logged.",
}: {
  logs: WorkLog[];
  showUser?: boolean;
  showDate?: boolean;
  canDelete: (l: WorkLog) => boolean;
  empty?: string;
}) {
  if (!logs.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((l) => (
        <li key={l.id} className="group flex items-start gap-3 px-4 py-3">
          <div className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-brand-700">{hrs(l.hours)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
              {showUser && <span className="font-medium text-stone-700">{l.user_name}</span>}
              {showDate && <span>{formatShort(l.log_date)}</span>}
              {l.task_id && (
                <Link href={`/tasks/${l.task_id}`} className="truncate text-brand-700 hover:underline">
                  {l.task_title}
                </Link>
              )}
            </div>
            {l.note && <p className="mt-0.5 whitespace-pre-line text-sm text-stone-700">{l.note}</p>}
          </div>
          {canDelete(l) && (
            <form action={deleteLog} className="no-print">
              <input type="hidden" name="id" value={l.id} />
              <button
                className="rounded px-1.5 text-xs text-stone-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                aria-label="Delete entry"
                title="Delete entry"
              >
                ✕
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
