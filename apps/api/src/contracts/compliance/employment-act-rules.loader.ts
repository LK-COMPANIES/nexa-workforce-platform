import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { ComplianceRuleType, Prisma } from "@prisma/client";
import { COMPLIANCE_RULE_DEFINITION_SCHEMAS } from "@nexa/validation";
import type { ComplianceRuleset } from "./types";

const RULE_TYPES: ComplianceRuleType[] = [
  "WRITTEN_CONTRACT_REQUIRED",
  "EMPLOYMENT_PARTICULARS_REQUIRED",
  "PROBATION_MAXIMUM_DURATION",
  "NOTICE_PERIOD_MINIMUM",
  "CASUAL_CONVERSION_THRESHOLD",
];

// Mirrors StatutoryRulesLoader's pattern exactly: bridges DB rows to plain
// data for the pure validator in compliance-validator.ts.
@Injectable()
export class EmploymentActRulesLoader {
  /** `tx` must already be scoped via runWithTenant by the caller. */
  async loadActiveKenyaRules(tx: Prisma.TransactionClient, asOfDate: Date): Promise<ComplianceRuleset> {
    const jurisdiction = await tx.statutoryJurisdiction.findUnique({ where: { countryCode: "KE" } });
    if (!jurisdiction) {
      throw new InternalServerErrorException("Kenya statutory jurisdiction reference data is not seeded.");
    }

    const versions = await Promise.all(
      RULE_TYPES.map((ruleType) =>
        tx.complianceRuleVersion.findFirst({
          where: {
            jurisdictionId: jurisdiction.id,
            ruleType,
            isActive: true,
            effectiveFrom: { lte: asOfDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        }),
      ),
    );

    const missing = RULE_TYPES.filter((_, index) => !versions[index]);
    if (missing.length > 0) {
      throw new InternalServerErrorException(
        `No active Kenya compliance rule version found for: ${missing.join(", ")} as of ${asOfDate.toISOString().slice(0, 10)}.`,
      );
    }

    const [written, particulars, probation, notice, casual] = versions;

    return {
      ruleVersionIds: {
        writtenContractRequired: written!.id,
        employmentParticularsRequired: particulars!.id,
        probationMaximumDuration: probation!.id,
        noticePeriodMinimum: notice!.id,
        casualConversionThreshold: casual!.id,
      },
      writtenContractRequired: COMPLIANCE_RULE_DEFINITION_SCHEMAS.WRITTEN_CONTRACT_REQUIRED.parse(
        written!.ruleDefinition,
      ),
      employmentParticularsRequired: COMPLIANCE_RULE_DEFINITION_SCHEMAS.EMPLOYMENT_PARTICULARS_REQUIRED.parse(
        particulars!.ruleDefinition,
      ),
      probationMaximumDuration: COMPLIANCE_RULE_DEFINITION_SCHEMAS.PROBATION_MAXIMUM_DURATION.parse(
        probation!.ruleDefinition,
      ),
      noticePeriodMinimum: COMPLIANCE_RULE_DEFINITION_SCHEMAS.NOTICE_PERIOD_MINIMUM.parse(notice!.ruleDefinition),
      casualConversionThreshold: COMPLIANCE_RULE_DEFINITION_SCHEMAS.CASUAL_CONVERSION_THRESHOLD.parse(
        casual!.ruleDefinition,
      ),
    };
  }
}
