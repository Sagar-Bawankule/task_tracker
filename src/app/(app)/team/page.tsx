import { requireAdmin } from "@/lib/auth";
import { listMembers } from "@/lib/data";
import { updateMember } from "@/lib/actions";
import { PageHeader, Section } from "@/components/ui";
import { AddMemberForm } from "@/components/forms";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin();
  const members = await listMembers(true);

  return (
    <>
      <PageHeader title="Team" subtitle="Add staff, set roles, reset passwords. Admins see everyone’s work; members see only their own." />
      <div className="space-y-6">
        <Section title="Add a team member">
          <AddMemberForm />
        </Section>

        <Section title={`Members (${members.filter((m) => m.active).length} active)`}>
          <ul className="divide-y divide-stone-100">
            {members.map((m) => (
              <li key={m.id} className={m.active ? "" : "bg-stone-50/70"}>
                <form action={updateMember} className="grid items-end gap-3 px-4 py-3 sm:grid-cols-12">
                  <input type="hidden" name="id" value={m.id} />
                  <div className="sm:col-span-3">
                    <label className="label">Name</label>
                    <input className="input" name="name" defaultValue={m.name} required />
                    <div className="mt-1 truncate text-xs text-stone-400">{m.email}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Department</label>
                    <input className="input" name="department" defaultValue={m.department} />
                    <div className="mt-1 text-xs">&nbsp;</div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Role</label>
                    <select className="input" name="role" defaultValue={m.role} disabled={m.id === admin.id}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    {m.id === admin.id && <input type="hidden" name="role" value="admin" />}
                    <div className="mt-1 text-xs">&nbsp;</div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">New password</label>
                    <input className="input" name="password" type="text" minLength={6} placeholder="Leave blank" />
                    <div className="mt-1 text-xs">&nbsp;</div>
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-3">
                    <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-600">
                      <input type="checkbox" name="active" defaultChecked={m.active} disabled={m.id === admin.id} className="h-4 w-4 accent-brand-600" />
                      Active
                      {m.id === admin.id && <input type="hidden" name="active" value="on" />}
                    </label>
                    <button className="btn-ghost ml-auto mb-6 sm:mb-6">Save</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
