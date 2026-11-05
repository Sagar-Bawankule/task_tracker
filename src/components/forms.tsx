"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addLog, addMember, changePassword, login, setTaskStatus, setupAdmin, type FormState } from "@/lib/actions";
import { STATUSES } from "@/lib/constants";

/** Submit via the action without React's automatic form reset, so typed values survive validation errors. */
function keepValues(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

export function LoginForm({ setup }: { setup: boolean }) {
  const [state, action, pending] = useActionState(setup ? setupAdmin : login, undefined);
  return (
    <form onSubmit={keepValues(action)} className="space-y-4">
      {setup && (
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input className="input" id="name" name="name" required autoComplete="name" defaultValue={state?.name} key={`n${state?.name}`} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} key={`e${state?.email}`} />
      </div>
      <div>
        <label className="label" htmlFor="password">{setup ? "Choose a password" : "Password"}</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          required
          minLength={setup ? 6 : undefined}
          autoComplete={setup ? "new-password" : "current-password"}
        />
      </div>
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Please wait…" : setup ? "Create admin account" : "Sign in"}
      </button>
    </form>
  );
}

export function LogWorkForm({
  date,
  maxDate,
  tasks,
  members,
}: {
  date: string;
  maxDate: string;
  tasks: { id: number; title: string }[];
  members?: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(addLog, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      const f = ref.current;
      if (!f) return;
      (f.elements.namedItem("note") as HTMLTextAreaElement).value = "";
      (f.elements.namedItem("hours") as HTMLInputElement).value = "";
      (f.elements.namedItem("task_id") as HTMLSelectElement).value = "";
      const md = f.elements.namedItem("mark_done") as HTMLInputElement | null;
      if (md) md.checked = false;
    }
  }, [state]);

  return (
    <form ref={ref} onSubmit={keepValues(action)} className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="log_date">Date</label>
          <input className="input" id="log_date" name="log_date" type="date" defaultValue={date} max={maxDate} required key={date} />
        </div>
        <div>
          <label className="label" htmlFor="hours">Hours spent</label>
          <input className="input" id="hours" name="hours" type="number" step="0.25" min="0" max="24" placeholder="e.g. 2.5" required />
        </div>
      </div>
      {members && members.length > 1 && (
        <div>
          <label className="label" htmlFor="user_id">Team member</label>
          <select className="input" id="user_id" name="user_id" defaultValue="">
            <option value="">Myself</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="task_id">Task (optional)</label>
        <select className="input" id="task_id" name="task_id" defaultValue="">
          <option value="">— Other / general work —</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="note">What did you work on?</label>
        <textarea className="input min-h-20" id="note" name="note" placeholder="e.g. Packed and dispatched 40 orders, followed up with 3 distributors…" />
      </div>
      {tasks.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" name="mark_done" className="h-4 w-4 accent-brand-600" />
          Mark selected task as done
        </label>
      )}
      <Msg state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Add work entry"}</button>
    </form>
  );
}

export function StatusSelect({ id, status }: { id: number; status: string }) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        aria-label="Change status"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-xs text-stone-700 outline-none focus:border-brand-400"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </form>
  );
}

/** Select that updates a URL search param (used for member filter / date pickers) */
export function ParamSelect({
  param,
  value,
  options,
  label,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select
      aria-label={label}
      className="input w-auto"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ParamInput({ param, value, type, label }: { param: string; value: string; type: "date" | "month"; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <input
      aria-label={label}
      type={type}
      className="input w-auto"
      value={value}
      onChange={(e) => {
        if (!e.target.value) return;
        const next = new URLSearchParams(sp.toString());
        next.set(param, e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    />
  );
}

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={keepValues(action)} className="grid gap-3 p-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="m-name">Full name</label>
        <input className="input" id="m-name" name="name" required />
      </div>
      <div>
        <label className="label" htmlFor="m-email">Email (used to sign in)</label>
        <input className="input" id="m-email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="m-dept">Department</label>
        <input className="input" id="m-dept" name="department" placeholder="e.g. Sales, Dispatch, Marketing" />
      </div>
      <div>
        <label className="label" htmlFor="m-pass">Temporary password</label>
        <input className="input" id="m-pass" name="password" type="text" minLength={6} required />
      </div>
      <div>
        <label className="label" htmlFor="m-role">Role</label>
        <select className="input" id="m-role" name="role" defaultValue="member">
          <option value="member">Member: sees own tasks and logs</option>
          <option value="admin">Admin: sees the whole team</option>
        </select>
      </div>
      <div className="flex items-end">
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add team member"}</button>
      </div>
      <div className="sm:col-span-2">
        <Msg state={state} />
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form onSubmit={keepValues(action)} className="space-y-3 p-4">
      <div>
        <label className="label" htmlFor="current">Current password</label>
        <input className="input" id="current" name="current" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <label className="label" htmlFor="next">New password</label>
        <input className="input" id="next" name="next" type="password" minLength={6} required autoComplete="new-password" />
      </div>
      <Msg state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}
