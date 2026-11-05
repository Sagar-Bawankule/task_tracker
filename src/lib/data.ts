import "server-only";
import { query, queryOne } from "./db";
import { daysBetween } from "./dates";

export type Task = {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignee_id: number | null;
  assignee_name: string | null;
  created_by_name: string | null;
  due_date: string | null;
  created_on: string;
  completed_on: string | null;
};

export type WorkLog = {
  id: number;
  user_id: number;
  user_name: string;
  task_id: number | null;
  task_title: string | null;
  task_category: string | null;
  log_date: string;
  hours: number;
  note: string;
};

export type Member = { id: number; name: string; email: string; role: string; department: string; active: boolean };

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.category, t.priority, t.status, t.assignee_id,
         a.name AS assignee_name, c.name AS created_by_name,
         t.due_date, t.created_on, t.completed_on
  FROM tasks t
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN users c ON c.id = t.created_by`;

const PRIORITY_ORDER = `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

export async function listMembers(includeInactive = false): Promise<Member[]> {
  return query<Member>(
    `SELECT id, name, email, role, department, active FROM users
     ${includeInactive ? "" : "WHERE active = TRUE"} ORDER BY active DESC, name`,
  );
}

export type TaskFilter = {
  assigneeId?: number | null;
  status?: string;
  priority?: string;
  category?: string;
  q?: string;
};

export async function listTasks(f: TaskFilter): Promise<Task[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.assigneeId) where.push(`t.assignee_id = ${p(f.assigneeId)}`);
  if (f.status === "open") where.push("t.status <> 'done'");
  else if (f.status) where.push(`t.status = ${p(f.status)}`);
  if (f.priority) where.push(`t.priority = ${p(f.priority)}`);
  if (f.category) where.push(`t.category = ${p(f.category)}`);
  if (f.q) {
    const ph = p(`%${f.q}%`);
    where.push(`(t.title ILIKE ${ph} OR t.description ILIKE ${ph})`);
  }
  return query<Task>(
    `${TASK_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY (t.status = 'done'), ${PRIORITY_ORDER}, t.due_date NULLS LAST, t.id DESC LIMIT 500`,
    params,
  );
}

export async function getTask(id: number): Promise<Task | null> {
  return queryOne<Task>(`${TASK_SELECT} WHERE t.id = $1`, [id]);
}

function scope(userId: number | null, col: string, params: unknown[]): string {
  if (!userId) return "";
  params.push(userId);
  return ` AND ${col} = $${params.length}`;
}

/** Open tasks that are due on/before the date (overdue + due that day) */
export async function openTasksDueBy(date: string, userId: number | null): Promise<Task[]> {
  const params: unknown[] = [date];
  return query<Task>(
    `${TASK_SELECT} WHERE t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date <= $1
     ${scope(userId, "t.assignee_id", params)} ORDER BY t.due_date, ${PRIORITY_ORDER}`,
    params,
  );
}

export async function openTasks(userId: number | null): Promise<Task[]> {
  const params: unknown[] = [];
  return query<Task>(
    `${TASK_SELECT} WHERE t.status <> 'done' ${scope(userId, "t.assignee_id", params)}
     ORDER BY ${PRIORITY_ORDER}, t.due_date NULLS LAST LIMIT 500`,
    params,
  );
}

export async function tasksCompletedBetween(from: string, to: string, userId: number | null): Promise<Task[]> {
  const params: unknown[] = [from, to];
  return query<Task>(
    `${TASK_SELECT} WHERE t.completed_on BETWEEN $1 AND $2 ${scope(userId, "t.assignee_id", params)}
     ORDER BY t.completed_on DESC, t.id DESC`,
    params,
  );
}

export async function tasksCreatedBetween(from: string, to: string, userId: number | null): Promise<Task[]> {
  const params: unknown[] = [from, to];
  return query<Task>(
    `${TASK_SELECT} WHERE t.created_on BETWEEN $1 AND $2 ${scope(userId, "t.assignee_id", params)}
     ORDER BY t.created_on DESC, t.id DESC`,
    params,
  );
}

export async function logsBetween(from: string, to: string, userId: number | null): Promise<WorkLog[]> {
  const params: unknown[] = [from, to];
  return query<WorkLog>(
    `SELECT l.id, l.user_id, u.name AS user_name, l.task_id, t.title AS task_title, t.category AS task_category,
            l.log_date, l.hours, l.note
     FROM work_logs l JOIN users u ON u.id = l.user_id LEFT JOIN tasks t ON t.id = l.task_id
     WHERE l.log_date BETWEEN $1 AND $2 ${scope(userId, "l.user_id", params)}
     ORDER BY l.log_date DESC, u.name, l.id`,
    params,
  );
}

export type DayStat = { date: string; hours: number; completed: number; created: number; logs: number };
export type PersonStat = {
  id: number;
  name: string;
  hours: number;
  completed: number;
  open: number;
  overdue: number;
  daysLogged: number;
};
export type CategoryStat = { category: string; completed: number; hours: number };

export type Summary = {
  from: string;
  to: string;
  hours: number;
  completed: number;
  created: number;
  logs: number;
  openNow: number;
  overdueNow: number;
  days: DayStat[];
  people: PersonStat[];
  categories: CategoryStat[];
  completedTasks: Task[];
  logList: WorkLog[];
};

export async function summary(from: string, to: string, userId: number | null, today: string): Promise<Summary> {
  const [logList, completedTasks, createdTasks, open, members] = await Promise.all([
    logsBetween(from, to, userId),
    tasksCompletedBetween(from, to, userId),
    tasksCreatedBetween(from, to, userId),
    openTasks(userId),
    userId
      ? query<Member>("SELECT id, name, email, role, department, active FROM users WHERE id = $1", [userId])
      : listMembers(),
  ]);

  const days: DayStat[] = daysBetween(from, to).map((date) => ({ date, hours: 0, completed: 0, created: 0, logs: 0 }));
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const l of logList) {
    const d = dayMap.get(l.log_date);
    if (d) {
      d.hours += Number(l.hours);
      d.logs++;
    }
  }
  for (const t of completedTasks) {
    const d = dayMap.get(t.completed_on ?? "");
    if (d) d.completed++;
  }
  for (const t of createdTasks) {
    const d = dayMap.get(t.created_on);
    if (d) d.created++;
  }

  type Acc = PersonStat & { dates: Set<string> };
  const people = new Map<number, Acc>();
  const person = (id: number | null, name: string | null): Acc | null => {
    if (id == null) return null;
    let p = people.get(id);
    if (!p) {
      p = { id, name: name ?? "Unknown", hours: 0, completed: 0, open: 0, overdue: 0, daysLogged: 0, dates: new Set() };
      people.set(id, p);
    }
    return p;
  };
  for (const m of members) person(m.id, m.name);
  for (const l of logList) {
    const p = person(l.user_id, l.user_name)!;
    p.hours += Number(l.hours);
    p.dates.add(l.log_date);
  }
  for (const t of completedTasks) {
    const p = person(t.assignee_id, t.assignee_name);
    if (p) p.completed++;
  }
  for (const t of open) {
    const p = person(t.assignee_id, t.assignee_name);
    if (p) {
      p.open++;
      if (t.due_date && t.due_date < today) p.overdue++;
    }
  }

  const cats = new Map<string, CategoryStat>();
  const cat = (c: string) => {
    let x = cats.get(c);
    if (!x) {
      x = { category: c, completed: 0, hours: 0 };
      cats.set(c, x);
    }
    return x;
  };
  for (const t of completedTasks) cat(t.category).completed++;
  for (const l of logList) cat(l.task_category ?? "Other work").hours += Number(l.hours);

  return {
    from,
    to,
    hours: days.reduce((s, d) => s + d.hours, 0),
    completed: completedTasks.length,
    created: createdTasks.length,
    logs: logList.length,
    openNow: open.length,
    overdueNow: open.filter((t) => t.due_date && t.due_date < today).length,
    days,
    people: [...people.values()]
      .map(({ dates, ...p }) => ({ ...p, daysLogged: dates.size }))
      .sort((a, b) => b.hours - a.hours || b.completed - a.completed || a.name.localeCompare(b.name)),
    categories: [...cats.values()].sort((a, b) => b.hours - a.hours || b.completed - a.completed),
    completedTasks,
    logList,
  };
}
