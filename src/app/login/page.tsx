import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { LoginForm } from "@/components/forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  await connection(); // always render per request (setup state & env can change)
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="card max-w-md p-6">
          <h1 className="text-lg font-semibold text-stone-900">Almost there: one setting is missing</h1>
          <p className="mt-2 text-sm text-stone-600">
            Add an environment variable named <code className="rounded bg-stone-100 px-1">AUTH_SECRET</code> with a long random
            value (Vercel → Project → Settings → Environment Variables), then redeploy.
          </p>
        </div>
      </main>
    );
  }
  if (await getCurrentUser()) redirect("/");
  const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
  const setup = !row || row.n === 0;

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
