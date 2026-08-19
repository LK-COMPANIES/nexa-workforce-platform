import { z } from "zod";

export const PAYROLL_RUN_TYPES = ["REGULAR", "OFF_CYCLE", "CORRECTION"] as const;

export const createPayrollRunSchema = z
  .object({
    payrollPeriodStart: z.coerce.date(),
    payrollPeriodEnd: z.coerce.date(),
    runType: z.enum(PAYROLL_RUN_TYPES).default("REGULAR"),
    currency: z.string().length(3).default("KES"),
  })
  .refine((value) => value.payrollPeriodEnd >= value.payrollPeriodStart, {
    message: "payrollPeriodEnd must not be before payrollPeriodStart",
    path: ["payrollPeriodEnd"],
  });

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const voidPayrollRunSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type VoidPayrollRunInput = z.infer<typeof voidPayrollRunSchema>;

// Ad-hoc "what-if" calculation (brief §14) — reuses the same engine and
// active statutory rules as a real payroll run, but persists nothing. Field
// shapes mirror packages/payroll-engine/src/types.ts exactly.
export const payrollCalculatorSchema = z.object({
  cashGrossPay: z.coerce.number().nonnegative(),
  nonCashBenefits: z
    .array(
      z.object({
        label: z.string().min(1).max(255),
        amount: z.coerce.number().nonnegative(),
        taxable: z.boolean(),
      }),
    )
    .default([]),
  allowableDeductions: z
    .array(
      z.object({
        type: z.enum([
          "APPROVED_PENSION_CONTRIBUTION",
          "MORTGAGE_INTEREST",
          "POST_RETIREMENT_MEDICAL_FUND",
          "OTHER_ALLOWABLE_STATUTORY",
        ]),
        amount: z.coerce.number().nonnegative(),
        taxTreatment: z.enum(["PRE_TAX", "POST_TAX"]),
        employeeImpact: z.boolean(),
        employerImpact: z.boolean(),
        description: z.string().max(255).optional(),
      }),
    )
    .default([]),
  otherDeductions: z
    .array(z.object({ label: z.string().min(1).max(255), amount: z.coerce.number().nonnegative() }))
    .default([]),
  payrollPeriodStart: z.coerce.date(),
  payrollPeriodEnd: z.coerce.date(),
  currency: z.string().length(3).default("KES"),
});

export type PayrollCalculatorInput = z.infer<typeof payrollCalculatorSchema>;
