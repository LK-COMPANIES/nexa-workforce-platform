import { z } from "zod";

// Shapes for ComplianceRuleVersion.ruleDefinition, one per ComplianceRuleType
// (mirrors packages/validation/src/statutory.ts's pattern for statutory
// rules). The compliance validator (apps/api/src/contracts/compliance)
// reads these — legal thresholds never appear as constants in that code.

export const probationMaximumDurationRuleSchema = z.object({
  initialMaximumMonths: z.number().positive(),
  extensionMaximumMonths: z.number().nonnegative(),
  totalMaximumMonths: z.number().positive(),
  extensionRequiresWrittenConsent: z.boolean(),
});
export type ProbationMaximumDurationRule = z.infer<typeof probationMaximumDurationRuleSchema>;

export const writtenContractRequiredRuleSchema = z.object({
  minimumAggregateDays: z.number().positive(),
  alsoRequiredForSpecifiedWork: z.boolean(),
});
export type WrittenContractRequiredRule = z.infer<typeof writtenContractRequiredRuleSchema>;

export const noticePeriodMinimumRuleSchema = z.object({
  dailyContractsNoticeDays: z.number().nonnegative(),
  subMonthlyContractsNoticePeriods: z.number().nonnegative(),
  monthlyOrLongerContractsNoticeDays: z.number().nonnegative(),
});
export type NoticePeriodMinimumRule = z.infer<typeof noticePeriodMinimumRuleSchema>;

export const casualConversionThresholdRuleSchema = z.object({
  continuousServiceThresholdDays: z.number().positive(),
  convertsToDescription: z.string(),
});
export type CasualConversionThresholdRule = z.infer<typeof casualConversionThresholdRuleSchema>;

export const employmentParticularsRequiredRuleSchema = z.object({
  requiredFields: z.array(z.string()).min(1),
  mustBeProvidedWithinDaysOfCommencement: z.number().positive(),
});
export type EmploymentParticularsRequiredRule = z.infer<typeof employmentParticularsRequiredRuleSchema>;

export const COMPLIANCE_RULE_DEFINITION_SCHEMAS = {
  PROBATION_MAXIMUM_DURATION: probationMaximumDurationRuleSchema,
  WRITTEN_CONTRACT_REQUIRED: writtenContractRequiredRuleSchema,
  NOTICE_PERIOD_MINIMUM: noticePeriodMinimumRuleSchema,
  CASUAL_CONVERSION_THRESHOLD: casualConversionThresholdRuleSchema,
  EMPLOYMENT_PARTICULARS_REQUIRED: employmentParticularsRequiredRuleSchema,
} as const;
