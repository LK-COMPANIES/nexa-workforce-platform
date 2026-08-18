import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { Prisma, StatutoryRuleType } from "@prisma/client";
import { STATUTORY_RULE_DEFINITION_SCHEMAS } from "@nexa/validation";
import type { KenyaPayrollRules } from "@nexa/payroll-engine";

export interface LoadedStatutoryRules {
  rules: KenyaPayrollRules;
  ruleVersionIds: Record<"PAYE" | "NSSF" | "SHIF" | "HOUSING_LEVY", string>;
}

const RULE_TYPES: StatutoryRuleType[] = ["PAYE", "NSSF", "SHIF", "HOUSING_LEVY"];

// Bridges the DB (Prisma, versioned rule rows) to the pure engine (plain
// KenyaPayrollRules data) — this is the ONLY place that adapter happens.
// packages/payroll-engine itself never imports Prisma (brief §13).
@Injectable()
export class StatutoryRulesLoader {
  /** `tx` must already be scoped via runWithTenant by the caller. */
  async loadActiveKenyaRules(tx: Prisma.TransactionClient, asOfDate: Date): Promise<LoadedStatutoryRules> {
    const jurisdiction = await tx.statutoryJurisdiction.findUnique({ where: { countryCode: "KE" } });
    if (!jurisdiction) {
      throw new InternalServerErrorException("Kenya statutory jurisdiction reference data is not seeded.");
    }

    const versions = await Promise.all(
      RULE_TYPES.map((ruleType) =>
        tx.statutoryRuleVersion.findFirst({
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

    const [paye, nssf, shif, housingLevy] = versions;
    const missing = RULE_TYPES.filter((_, index) => !versions[index]);
    if (missing.length > 0) {
      throw new InternalServerErrorException(
        `No active Kenya statutory rule version found for: ${missing.join(", ")} as of ${asOfDate.toISOString().slice(0, 10)}. ` +
          "Payroll cannot be calculated without a complete, active statutory ruleset.",
      );
    }

    // Re-validate shape at read time too, not just at seed time — a
    // hand-edited row in the DB must not silently corrupt a payroll run.
    const payeDefinition = STATUTORY_RULE_DEFINITION_SCHEMAS.PAYE.parse(paye!.ruleDefinition);
    const nssfDefinition = STATUTORY_RULE_DEFINITION_SCHEMAS.NSSF.parse(nssf!.ruleDefinition);
    const shifDefinition = STATUTORY_RULE_DEFINITION_SCHEMAS.SHIF.parse(shif!.ruleDefinition);
    const housingLevyDefinition = STATUTORY_RULE_DEFINITION_SCHEMAS.HOUSING_LEVY.parse(housingLevy!.ruleDefinition);

    const ruleVersionIds = {
      PAYE: paye!.id,
      NSSF: nssf!.id,
      SHIF: shif!.id,
      HOUSING_LEVY: housingLevy!.id,
    } as const;

    return {
      rules: {
        jurisdiction: "KE",
        paye: payeDefinition,
        nssf: nssfDefinition,
        shif: shifDefinition,
        housingLevy: housingLevyDefinition,
        ruleVersionIds: {
          paye: ruleVersionIds.PAYE,
          nssf: ruleVersionIds.NSSF,
          shif: ruleVersionIds.SHIF,
          housingLevy: ruleVersionIds.HOUSING_LEVY,
        },
      },
      ruleVersionIds,
    };
  }
}
