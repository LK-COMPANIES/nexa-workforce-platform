// Permission keys, grouped by domain. Format is "<resource>:<action>". Kept
// as plain string literals (rather than a Prisma/DB enum) so new permissions
// can be introduced as data — seeded rows in the `permissions` table —
// without a schema migration.
//
// Phase 2 naming reconciliation: `organization:write` -> `organization:update`,
// `employee:write` -> split into `employee:create` / `employee:update`,
// `contract:write` -> split into `contract:create` / `contract:update`,
// `payroll:calculate` -> `payroll:process`, `ai_audit_log:*` -> `ai_audit:*`,
// to match this brief's explicit permission examples. Added `user:*` and
// `audit:read` (new Session/AuthenticationAuditEvent surface).
export const PERMISSION_KEYS = [
  // Organization
  "organization:read",
  "organization:update",
  "organization:manage_members",

  // User accounts (within an organization membership context)
  "user:read",
  "user:create",
  "user:update",
  "user:disable",

  // Employee
  "employee:read",
  "employee:create",
  "employee:update",

  // Contract
  "contract:read",
  "contract:create",
  "contract:update",
  "contract:approve",

  // Payroll
  "payroll:read",
  "payroll:process",
  "payroll:approve",

  // Security / authentication audit trail (AuthenticationAuditEvent)
  "audit:read",

  // AI governance (AIAuditLog)
  "ai_audit:read",
  "ai_audit:review",

  // Platform administration (cross-tenant; intended only for
  // nexa_super_admin — see packages/auth/src/role-permissions.ts)
  "platform:manage_organizations",
  "platform:manage_roles",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
