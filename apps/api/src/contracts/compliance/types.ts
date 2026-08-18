import type {
  CasualConversionThresholdRule,
  EmploymentParticularsRequiredRule,
  NoticePeriodMinimumRule,
  ProbationMaximumDurationRule,
  WrittenContractRequiredRule,
} from "@nexa/validation";

export interface ContractComplianceInput {
  contractType: string;
  effectiveDate: Date;
  expirationDate: Date | null;
  jobTitle: string | null;
  jobDescription: string | null;
  workLocation: string | null;
  workingHoursPerWeek: number | null;
  baseCompensation: number | null;
  paymentInterval: string | null;
  probationMonths: number | null;
  probationExtendedMonths: number | null;
  probationExtensionConsent: boolean | null;
  noticePeriodDays: number | null;
  continuousEmploymentDate: Date | null;
}

export interface ComplianceRuleset {
  ruleVersionIds: {
    writtenContractRequired: string;
    employmentParticularsRequired: string;
    probationMaximumDuration: string;
    noticePeriodMinimum: string;
    casualConversionThreshold: string;
  };
  writtenContractRequired: WrittenContractRequiredRule;
  employmentParticularsRequired: EmploymentParticularsRequiredRule;
  probationMaximumDuration: ProbationMaximumDurationRule;
  noticePeriodMinimum: NoticePeriodMinimumRule;
  casualConversionThreshold: CasualConversionThresholdRule;
}
