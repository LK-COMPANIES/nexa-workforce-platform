import { z } from "zod";
import { contractDocumentModelSchema, paymentIntervalSchema } from "./contract-terms";

export const CONTRACT_TYPES = [
  "PERMANENT_EMPLOYMENT",
  "FIXED_TERM_EMPLOYMENT",
  "CASUAL",
  "TEMPORARY_STAFFING",
  "OUTSOURCED_WORKFORCE",
  "CONSULTING_ENGAGEMENT",
  "CLIENT_SERVICES_AGREEMENT",
  "INTERNSHIP",
] as const;

export const createContractSchema = z.object({
  employeeId: z.string().uuid().optional(),
  contractType: z.enum(CONTRACT_TYPES),
  title: z.string().min(1).max(255),
  referenceCode: z.string().max(100).optional(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  baseCompensation: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  paymentInterval: paymentIntervalSchema.optional(),

  jobTitle: z.string().max(255).optional(),
  jobDescription: z.string().max(4000).optional(),
  workLocation: z.string().max(255).optional(),
  workingHoursPerWeek: z.coerce.number().positive().max(168).optional(),
  probationMonths: z.coerce.number().int().nonnegative().max(24).optional(),
  probationExtendedMonths: z.coerce.number().int().nonnegative().max(24).optional(),
  probationExtensionConsent: z.coerce.boolean().optional(),
  noticePeriodDays: z.coerce.number().int().nonnegative().optional(),
  continuousEmploymentDate: z.coerce.date().optional(),

  terms: contractDocumentModelSchema.optional(),

  documentStorageKey: z.string().max(1024).optional(),
})
  .refine((value) => !value.expirationDate || value.expirationDate > value.effectiveDate, {
    message: "expirationDate must be after effectiveDate",
    path: ["expirationDate"],
  })
  .refine(
    (value) =>
      value.probationExtendedMonths === undefined ||
      value.probationExtendedMonths === 0 ||
      value.probationExtensionConsent === true,
    {
      message: "extending probation requires explicit employee consent (probationExtensionConsent)",
      path: ["probationExtensionConsent"],
    },
  );

export type CreateContractInput = z.infer<typeof createContractSchema>;

const updateContractBaseSchema = z.object({
  employeeId: z.string().uuid().optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  title: z.string().min(1).max(255).optional(),
  referenceCode: z.string().max(100).optional(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  baseCompensation: z.coerce.number().positive().optional(),
  currency: z.string().length(3).optional(),
  paymentInterval: paymentIntervalSchema.optional(),
  jobTitle: z.string().max(255).optional(),
  jobDescription: z.string().max(4000).optional(),
  workLocation: z.string().max(255).optional(),
  workingHoursPerWeek: z.coerce.number().positive().max(168).optional(),
  probationMonths: z.coerce.number().int().nonnegative().max(24).optional(),
  probationExtendedMonths: z.coerce.number().int().nonnegative().max(24).optional(),
  probationExtensionConsent: z.coerce.boolean().optional(),
  noticePeriodDays: z.coerce.number().int().nonnegative().optional(),
  continuousEmploymentDate: z.coerce.date().optional(),
  terms: contractDocumentModelSchema.optional(),
  documentStorageKey: z.string().max(1024).optional(),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "TERMINATED", "EXPIRED"])
    .optional(),
});

export const updateContractSchema = updateContractBaseSchema;

export type UpdateContractInput = z.infer<typeof updateContractSchema>;
