// Baseline Nexa engagement models — reference data (see
// packages/database/prisma/seed.ts), not hard-coded application logic.
export const ENGAGEMENT_TYPE_KEYS = [
  "PROJECT_BASED_CONSULTING",
  "MONTHLY_RETAINER",
  "FULLY_MANAGED_SERVICES",
  "ANNUAL_AUDIT_COMPLIANCE",
  "TECHNOLOGY_IMPLEMENTATION_SUPPORT",
] as const;

export type EngagementTypeKey = (typeof ENGAGEMENT_TYPE_KEYS)[number];
