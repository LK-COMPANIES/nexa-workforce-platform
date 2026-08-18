// System role keys. These map 1:1 to seeded rows in the `roles` table (see
// packages/database/prisma/seed.ts) via the `key` column — the Role table
// itself is the source of truth, so additional (non-system) roles can be
// added later purely as data, with no code or schema change.
//
// Phase 2 note: `external_employee` (Phase 1) was renamed to `employee` to
// match this brief's explicit minimum role list (NEXA_SUPER_ADMIN,
// CLIENT_ADMIN, HR_MANAGER, BPO_AGENT, EMPLOYEE). `bpo_supervisor` is kept as
// an addition beyond that minimum — removing it would be an unnecessary,
// destructive rebuild of working Phase 1 seed data for no security reason.
export const SYSTEM_ROLE_KEYS = [
  "nexa_super_admin",
  "client_admin",
  "hr_manager",
  "bpo_supervisor",
  "bpo_agent",
  "employee",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];
