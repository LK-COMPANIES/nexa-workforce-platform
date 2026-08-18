// Mirrors StatutoryRuleType in schema.prisma.
export const STATUTORY_RULE_TYPES = ["PAYE", "NSSF", "SHIF", "HOUSING_LEVY"] as const;
export type StatutoryRuleType = (typeof STATUTORY_RULE_TYPES)[number];
