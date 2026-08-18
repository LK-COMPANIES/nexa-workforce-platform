import { z } from "zod";

// ContractDocumentModel — structured contract content (brief §31). Feeds a
// FUTURE document-rendering layer (PDF/DOCX); the compliance validator reads
// from this plus the extracted Contract columns (jobTitle, probationMonths,
// etc. — see schema.prisma), never generates prose itself.
export const paymentIntervalSchema = z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]);

export const contractPartiesSchema = z.object({
  employerLegalName: z.string().min(1),
  employeeFullName: z.string().min(1),
  employeeAddress: z.string().optional(),
  employeeSex: z.string().optional(),
  employeeAge: z.number().int().positive().optional(),
});

export const contractEmploymentTermsSchema = z.object({
  jobTitle: z.string().min(1),
  jobDescription: z.string().min(1),
  commencementDate: z.coerce.date(),
  continuousEmploymentDate: z.coerce.date().optional(),
  formAndDuration: z.string().min(1),
  placeOfWork: z.string().min(1),
});

export const contractRemunerationSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentInterval: paymentIntervalSchema,
  methodOfCalculation: z.string().optional(),
});

export const contractWorkingHoursSchema = z.object({
  hoursPerWeek: z.number().positive(),
  daysPerWeek: z.number().positive().optional(),
  overtimePolicy: z.string().optional(),
});

export const contractProbationSchema = z.object({
  initialMonths: z.number().nonnegative().optional(),
  extendedMonths: z.number().nonnegative().optional(),
  extensionConsentObtained: z.boolean().optional(),
});

export const contractBenefitsSchema = z.object({
  medicalCover: z.string().optional(),
  pensionScheme: z.string().optional(),
  otherBenefits: z.array(z.string()).default([]),
});

export const contractLeaveSchema = z.object({
  annualLeaveDays: z.number().nonnegative(),
  sickLeaveDays: z.number().nonnegative().optional(),
  sickLeavePayTerms: z.string().optional(),
  maternityPaternityLeaveNotes: z.string().optional(),
});

export const contractTerminationSchema = z.object({
  noticePeriodDays: z.number().nonnegative(),
  severanceTerms: z.string().optional(),
  summaryDismissalGrounds: z.array(z.string()).default([]),
});

export const contractDisciplinarySchema = z.object({
  frameworkSummary: z.string().min(1),
  disciplinaryProcedureReference: z.string().optional(),
});

export const contractGrievanceSchema = z.object({
  procedureSummary: z.string().min(1),
});

export const contractConfidentialitySchema = z.object({
  clauseSummary: z.string().min(1),
  survivesTermination: z.boolean().default(true),
});

export const contractDataProtectionSchema = z.object({
  clauseSummary: z.string().min(1),
  dataControllerName: z.string().optional(),
});

export const contractHealthSafetySchema = z.object({
  clauseSummary: z.string().optional(),
});

export const contractDocumentModelSchema = z.object({
  metadata: z
    .object({
      generatedAt: z.coerce.date().optional(),
      templateVersion: z.string().default("1.0.0"),
    })
    .default({ templateVersion: "1.0.0" }),
  parties: contractPartiesSchema,
  employmentTerms: contractEmploymentTermsSchema,
  remuneration: contractRemunerationSchema,
  workingHours: contractWorkingHoursSchema,
  probation: contractProbationSchema.optional(),
  benefits: contractBenefitsSchema.optional(),
  leave: contractLeaveSchema,
  termination: contractTerminationSchema,
  disciplinary: contractDisciplinarySchema,
  grievance: contractGrievanceSchema,
  confidentiality: contractConfidentialitySchema,
  dataProtection: contractDataProtectionSchema,
  healthSafety: contractHealthSafetySchema.optional(),
});

export type ContractDocumentModel = z.infer<typeof contractDocumentModelSchema>;
