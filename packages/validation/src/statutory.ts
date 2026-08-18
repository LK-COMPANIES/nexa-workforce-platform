import { z } from "zod";

// Shapes for StatutoryRuleVersion.ruleDefinition, one per StatutoryRuleType.
// Validated by the seed script before insert, and reusable by any future
// payroll calculation engine that reads these rows — the shape lives here,
// not duplicated in application code.

export const payeRuleDefinitionSchema = z.object({
  bands: z
    .array(
      z.object({
        monthlyFrom: z.number().nonnegative(),
        monthlyTo: z.number().positive().nullable(), // null = open-ended top band
        rate: z.number().min(0).max(1),
      }),
    )
    .min(1),
  personalReliefMonthly: z.number().nonnegative(),
  personalReliefAnnual: z.number().nonnegative(),
  appliesTo: z.literal("EMPLOYEE"),
});
export type PayeRuleDefinition = z.infer<typeof payeRuleDefinitionSchema>;

export const nssfRuleDefinitionSchema = z.object({
  tiers: z
    .array(
      z.object({
        tier: z.enum(["I", "II"]),
        lowerLimit: z.number().nonnegative(),
        upperLimit: z.number().positive(),
        employeeRate: z.number().min(0).max(1),
        employerRate: z.number().min(0).max(1),
        employeeCap: z.number().nonnegative(),
        employerCap: z.number().nonnegative(),
      }),
    )
    .min(1),
  maxEmployeeContribution: z.number().nonnegative(),
  maxEmployerContribution: z.number().nonnegative(),
  appliesTo: z.literal("EMPLOYEE_AND_EMPLOYER"),
});
export type NssfRuleDefinition = z.infer<typeof nssfRuleDefinitionSchema>;

export const shifRuleDefinitionSchema = z.object({
  rate: z.number().min(0).max(1),
  minimumMonthlyContribution: z.number().nonnegative().nullable(),
  cap: z.number().positive().nullable(),
  appliesTo: z.literal("EMPLOYEE"),
});
export type ShifRuleDefinition = z.infer<typeof shifRuleDefinitionSchema>;

export const housingLevyRuleDefinitionSchema = z.object({
  employeeRate: z.number().min(0).max(1),
  employerRate: z.number().min(0).max(1),
  cap: z.number().positive().nullable(),
  appliesTo: z.literal("EMPLOYEE_AND_EMPLOYER"),
});
export type HousingLevyRuleDefinition = z.infer<typeof housingLevyRuleDefinitionSchema>;

export const STATUTORY_RULE_DEFINITION_SCHEMAS = {
  PAYE: payeRuleDefinitionSchema,
  NSSF: nssfRuleDefinitionSchema,
  SHIF: shifRuleDefinitionSchema,
  HOUSING_LEVY: housingLevyRuleDefinitionSchema,
} as const;
