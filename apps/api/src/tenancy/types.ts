import type { PermissionKey } from "@nexa/types";

// Populated in two stages:
//   1. JwtAuthGuard sets identity fields from the verified token (userId,
//      organizationId, sessionId) and a placeholder roleKey/permissions.
//   2. TenantContextGuard OVERWRITES roleKey/permissions/isSuperAdminSession
//      with values freshly read from the database (live session validity +
//      live OrganizationMembership), inside the same RLS-scoped transaction
//      it uses to validate the session. Nothing downstream should ever treat
//      stage-1 permissions as authoritative — only the guard-refreshed value is.
export interface RequestTenantContext {
  userId: string;
  organizationId: string;
  sessionId: string;
  roleKey: string;
  permissions: PermissionKey[];
  isSuperAdminSession: boolean;
}
