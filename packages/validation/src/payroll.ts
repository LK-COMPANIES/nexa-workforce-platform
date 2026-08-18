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
