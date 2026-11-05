import { requireUser } from "@/lib/auth";
import { listMembers } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/import-wizard";

export const metadata = { title: "Import tasks" };

export default async function ImportPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const members = isAdmin ? await listMembers() : [];
  return (
    <>
      <PageHeader
        title="Import tasks from Excel"
        subtitle="Upload your task sheet. Next time, upload the updated sheet again: new rows are added and existing ones are updated, never duplicated."
      />
      <div className="max-w-5xl">
        <ImportWizard members={members.map((m) => ({ id: m.id, name: m.name }))} currentUserId={user.id} isAdmin={isAdmin} />
      </div>
    </>
  );
}
