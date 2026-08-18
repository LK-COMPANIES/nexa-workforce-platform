import type { KenyaPayrollRules } from "./types";

// Mirrors EXACTLY the ruleDefinition JSON shapes seeded in
// packages/database/prisma/seed.ts (KENYA_STATUTORY_SEED_2026) — kept in
// sync manually since this package has zero dependency on @nexa/database or
// @nexa/validation by design. Used by this package's own test suite; NOT
// exported from index.ts (callers must supply their own rules, sourced from
// the database — see apps/api/src/payroll/statutory-rules.loader.ts).
export const KENYA_2026_RULES: KenyaPayrollRules = {
  jurisdiction: "KE",
  paye: {
    bands: [
      { monthlyFrom: 0, monthlyTo: 24000, rate: 0.1 },
      { monthlyFrom: 24000.01, monthlyTo: 32333, rate: 0.25 },
      { monthlyFrom: 32333.01, monthlyTo: 500000, rate: 0.3 },
      { monthlyFrom: 500000.01, monthlyTo: 800000, rate: 0.325 },
      { monthlyFrom: 800000.01, monthlyTo: null, rate: 0.35 },
    ],
    personalReliefMonthly: 2400,
  },
  nssf: {
    tiers: [
      { tier: "I", lowerLimit: 0, upperLimit: 9000, employeeRate: 0.06, employerRate: 0.06 },
      { tier: "II", lowerLimit: 9000, upperLimit: 108000, employeeRate: 0.06, employerRate: 0.06 },
    ],
  },
  shif: {
    rate: 0.0275,
    minimumMonthlyContribution: null,
    cap: null,
  },
  housingLevy: {
    employeeRate: 0.015,
    employerRate: 0.015,
    cap: null,
  },
};
