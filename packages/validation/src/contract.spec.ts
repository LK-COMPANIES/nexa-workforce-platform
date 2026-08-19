import { createContractSchema, updateContractSchema } from "./contract";

// Shared by apps/api's DTO validation AND apps/web's ContractGeneratorForm
// (Phase 4 brief §21: the same zod schema drives both) — a regression here
// silently affects both the API boundary and the "New contract" form.
const validBase = {
  contractType: "PERMANENT_EMPLOYMENT" as const,
  title: "Software Engineer — Permanent",
  effectiveDate: "2026-09-01",
  jobTitle: "Software Engineer",
  jobDescription: "Builds and maintains the platform.",
  workLocation: "Nairobi, Kenya",
  workingHoursPerWeek: 40,
  noticePeriodDays: 28,
};

describe("createContractSchema", () => {
  it("accepts a minimal valid contract", () => {
    const result = createContractSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects a title that is empty", () => {
    const result = createContractSchema.safeParse({ ...validBase, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown contractType", () => {
    const result = createContractSchema.safeParse({ ...validBase, contractType: "PERMANENT_JOB" });
    expect(result.success).toBe(false);
  });

  it("rejects an expirationDate that is not after effectiveDate", () => {
    const result = createContractSchema.safeParse({
      ...validBase,
      contractType: "FIXED_TERM_EMPLOYMENT",
      effectiveDate: "2026-09-01",
      expirationDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("expirationDate");
    }
  });

  it("accepts an expirationDate that is after effectiveDate", () => {
    const result = createContractSchema.safeParse({
      ...validBase,
      contractType: "FIXED_TERM_EMPLOYMENT",
      effectiveDate: "2026-09-01",
      expirationDate: "2027-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects extending probation without explicit consent (Employment Act s.42(2))", () => {
    const result = createContractSchema.safeParse({
      ...validBase,
      probationMonths: 6,
      probationExtendedMonths: 3,
      probationExtensionConsent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("probationExtensionConsent");
    }
  });

  it("accepts extending probation when consent is explicitly true", () => {
    const result = createContractSchema.safeParse({
      ...validBase,
      probationMonths: 6,
      probationExtendedMonths: 3,
      probationExtensionConsent: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitting probation extension fields entirely", () => {
    const result = createContractSchema.safeParse({ ...validBase, probationMonths: 6 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative baseCompensation", () => {
    const result = createContractSchema.safeParse({ ...validBase, baseCompensation: -1000 });
    expect(result.success).toBe(false);
  });

  it("rejects workingHoursPerWeek above 168 (the number of hours in a week)", () => {
    const result = createContractSchema.safeParse({ ...validBase, workingHoursPerWeek: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects a currency code that is not exactly 3 characters", () => {
    const result = createContractSchema.safeParse({ ...validBase, currency: "KSH1" });
    expect(result.success).toBe(false);
  });
});

describe("updateContractSchema", () => {
  it("accepts a partial update with a single field", () => {
    const result = updateContractSchema.safeParse({ jobTitle: "Senior Software Engineer" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    const result = updateContractSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = updateContractSchema.safeParse({ status: "ARCHIVED" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid status transition value", () => {
    const result = updateContractSchema.safeParse({ status: "ACTIVE" });
    expect(result.success).toBe(true);
  });
});
