import { requireUser } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" subtitle={`${user.name} · ${user.email}${user.department ? ` · ${user.department}` : ""}`} />
      <div className="max-w-md">
        <Section title="Change password">
          <ChangePasswordForm />
        </Section>
      </div>
    </>
  );
}
