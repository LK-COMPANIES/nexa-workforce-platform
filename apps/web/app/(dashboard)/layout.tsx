import type { ReactNode } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiListMemberships } from "../../lib/api/auth";
import { apiGetCurrentOrganization } from "../../lib/api/organizations";
import { requireSession } from "../../lib/auth/session";

function formatRoleKey(roleKey: string): string {
  return roleKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const [organization, memberships] = await Promise.all([apiGetCurrentOrganization(), apiListMemberships()]);

  return (
    <AppShell
      session={{
        organizationDisplayName: organization.displayName,
        permissions: session.tenant.permissions,
        memberships,
        user: { firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email },
        roleName: formatRoleKey(session.tenant.roleKey),
      }}
    >
      {children}
    </AppShell>
  );
}
