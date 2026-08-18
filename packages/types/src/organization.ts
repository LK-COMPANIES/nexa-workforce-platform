// Mirrors the `OrganizationType` enum in packages/database/prisma/schema.prisma.
// Duplicated here (rather than imported from @prisma/client) so packages/types
// stays importable from the browser bundle without pulling in Prisma.
export const ORGANIZATION_TYPES = [
  "NEXA_HOLDING",
  "SUBSIDIARY",
  "CLIENT",
  "CLIENT_BUSINESS_UNIT",
  "OPERATIONAL_ENTITY",
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
