import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
type QueryFn = (text: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    department TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'todo',
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT,
    created_on TEXT NOT NULL,
    completed_on TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS work_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    log_date TEXT NOT NULL,
    hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_on)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_date ON work_logs(log_date)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_user ON work_logs(user_id)`,
];

const g = globalThis as unknown as { __dbReady?: Promise<QueryFn> };

async function connect(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let run: QueryFn;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    run = async (text, params = []) => (await sql.query(text, params)) as Row[];
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is not set. Add a Neon Postgres database in your Vercel project (Storage tab) and redeploy.",
      );
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite("./.pglite");
    run = async (text, params = []) => (await db.query<Row>(text, params)).rows;
  }
  for (const stmt of SCHEMA) await run(stmt);
  return run;
}

function ready(): Promise<QueryFn> {
  if (!g.__dbReady) {
    g.__dbReady = connect().catch((e) => {
      g.__dbReady = undefined;
      throw e;
    });
  }
  return g.__dbReady;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await ready();
  return (await run(text, params)) as T[];
}

export async function queryOne<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
