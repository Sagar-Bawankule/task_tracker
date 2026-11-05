import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { databaseUrl, queryOne } from "@/lib/db";
import { LoginForm } from "@/components/forms";

export const metadata = { title: "Sign in" };

function SetupProblem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 px-4">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
        <div className="mt-3 space-y-2 text-sm text-stone-600">{children}</div>
        <p className="mt-4 text-xs text-stone-400">After changing settings on Vercel, go to Deployments → ⋯ → Redeploy.</p>
      </div>
    </main>
  );
}

const code = "rounded bg-stone-100 px-1 font-mono text-[13px]";

export default async function LoginPage() {
  await connection(); // always render per request (setup state & env can change)

  const onVercel = !!process.env.VERCEL;
  const missingSecret = process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET;
  const missingDb = onVercel && !databaseUrl();
  if (missingSecret || missingDb) {
    return (
      <SetupProblem title="Almost there: some settings are missing">
        <p>This deployment needs the following before it can run:</p>
        <ul className="list-disc space-y-2 pl-5">
          {missingDb && (
            <li>
              <b>Database:</b> in your Vercel project open <b>Storage → Create Database → Neon</b> and connect it to this
              project. That adds <code className={code}>DATABASE_URL</code> for you.
            </li>
          )}
          {missingSecret && (
            <li>
              <b>Login secret:</b> in <b>Settings → Environment Variables</b> add <code className={code}>AUTH_SECRET</code> with a
              long random value.
            </li>
          )}
        </ul>
      </SetupProblem>
    );
  }

  let setup = false;
  let signedIn = false;
  try {
    signedIn = !!(await getCurrentUser());
    const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
    setup = !row || row.n === 0;
  } catch (e) {
    console.error("Database error on /login:", e);
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[connection string]");
    return (
      <SetupProblem title="Can’t connect to the database">
        <p>The app found a database setting but could not connect. Check that the Neon database is connected to this Vercel project and that its connection string is correct.</p>
        <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-700">{msg.slice(0, 300)}</p>
      </SetupProblem>
    );
  }
  if (signedIn) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 via-white to-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">SB</span>
          <h1 className="text-xl font-semibold text-stone-900">Shree Beauty Work Tracker</h1>
          <p className="mt-1 text-sm text-stone-500">
            {setup ? "First-time setup: create the admin account." : "Sign in to log and track your work."}
          </p>
        </div>
        <div className="card p-6">
          <LoginForm setup={setup} />
        </div>
      </div>
    </main>
  );
}
