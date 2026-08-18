import type { PermissionKey, SystemRoleKey } from "@nexa/types";

// Default permission matrix for the system roles, applying least privilege:
// every grant below is justified by what that role must legitimately do,
// nothing is included "just in case". This is the application-layer
// authorization decision; Postgres RLS (see packages/database/prisma/rls/)
// is the independent, database-layer enforcement — the two are intentionally
// redundant, not either/or. This matrix seeds `role_permissions` (see
// packages/database/prisma/seed.ts) but is not itself the runtime source of
// truth once seeded — a deployed instance's Role/Permission tables can
// diverge (e.g. a custom role) without any code change.
export const ROLE_PERMISSION_MAP: Record<SystemRoleKey, readonly PermissionKey[]> = {
  // The Nexa platform operator. Full access is justified because this role
  // is inherently cross-tenant and platform-operational by design — every
  // use of it is logged as SUPER_ADMIN_ORG_ACCESS (see
  // AuthenticationAuditEvent), which is the actual control, not a narrower
  // permission set that would just be worked around anyway.
  nexa_super_admin: [
    "platform:manage_organizations",
    "platform:manage_roles",
    "organization:read",
    "organization:update",
    "organization:manage_members",
    "user:read",
    "user:create",
    "user:update",
    "user:disable",
    "employee:read",
    "employee:create",
    "employee:update",
    "contract:read",
    "contract:create",
    "contract:update",
    "contract:approve",
    "payroll:read",
    "payroll:process",
    "payroll:approve",
    "audit:read",
    "ai_audit:read",
    "ai_audit:review",
  ],
  // Runs one client organization end-to-end: manages its membership and
  // profile, can see and act on everything within it, and approves
  // (but does not itself calculate — see hr_manager) payroll and contracts
  // as the accountable signatory. No platform:* — a client admin has zero
  // legitimate reason to touch another organization or global reference data.
  client_admin: [
    "organization:read",
    "organization:update",
    "organization:manage_members",
    "user:read",
    "user:create",
    "user:update",
    "user:disable",
    "employee:read",
    "employee:create",
    "employee:update",
    "contract:read",
    "contract:create",
    "contract:update",
    "contract:approve",
    "payroll:read",
    "payroll:approve",
    "audit:read",
    "ai_audit:read",
  ],
  // Runs day-to-day HR operations: full employee/contract read-write and
  // payroll *processing*. Deliberately NOT payroll:approve or contract:approve
  // — separation of duties, the preparer should not also be the approver.
  // Deliberately NOT user:create/update/disable — account administration is
  // client_admin's job, not HR's.
  hr_manager: [
    "organization:read",
    "user:read",
    "employee:read",
    "employee:create",
    "employee:update",
    "contract:read",
    "contract:create",
    "contract:update",
    "payroll:read",
    "payroll:process",
    "ai_audit:read",
  ],
  // Supervisory visibility over a BPO team: read-only across the board, no
  // write access to any domain entity.
  bpo_supervisor: ["organization:read", "employee:read", "contract:read", "ai_audit:read"],
  // Frontline operational role. Only what's needed to look up a colleague —
  // no organization, contract, or payroll visibility at all.
  bpo_agent: ["employee:read"],
  // Baseline self-service role. No RBAC permissions by design — an
  // employee's access to their OWN record is a resource-ownership check
  // (employee.userId === current user), not a role permission, and is
  // implemented at the query layer rather than here.
  employee: [],
};

export function permissionsForRole(role: SystemRoleKey): readonly PermissionKey[] {
  return ROLE_PERMISSION_MAP[role];
}

export function roleHasPermission(role: SystemRoleKey, permission: PermissionKey): boolean {
  return ROLE_PERMISSION_MAP[role].includes(permission);
}
