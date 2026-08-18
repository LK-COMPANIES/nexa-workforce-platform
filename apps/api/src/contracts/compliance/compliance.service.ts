import { Injectable, NotFoundException } from "@nestjs/common";
import type { Contract } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestTenantContext } from "../../tenancy/types";
import { COMPLIANCE_ENGINE_VERSION, validateContractCompliance } from "./compliance-validator";
import { EmploymentActRulesLoader } from "./employment-act-rules.loader";
import type { ContractComplianceInput } from "./types";

function toComplianceInput(contract: Contract): ContractComplianceInput {
  return {
    contractType: contract.contractType,
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    jobTitle: contract.jobTitle,
    jobDescription: contract.jobDescription,
    workLocation: contract.workLocation,
    workingHoursPerWeek: contract.workingHoursPerWeek ? Number(contract.workingHoursPerWeek) : null,
    baseCompensation: contract.baseCompensation ? Number(contract.baseCompensation) : null,
    paymentInterval: contract.paymentInterval,
    probationMonths: contract.probationMonths,
    probationExtendedMonths: contract.probationExtendedMonths,
    probationExtensionConsent: contract.probationExtensionConsent,
    noticePeriodDays: contract.noticePeriodDays,
    continuousEmploymentDate: contract.continuousEmploymentDate,
  };
}

// Every evaluation is a NEW row — brief §34: "compliance history is
// evidence," never overwritten. A contract's compliance status can only be
// read as "the most recent evaluation," never mutated in place.
@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesLoader: EmploymentActRulesLoader,
  ) {}

  async evaluateContract(tenant: RequestTenantContext, contractId: string) {
    return this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      async (tx) => {
        const contract = await tx.contract.findUnique({ where: { id: contractId } });
        if (!contract) {
          throw new NotFoundException("Contract not found");
        }

        const rules = await this.rulesLoader.loadActiveKenyaRules(tx, new Date());
        const result = validateContractCompliance(toComplianceInput(contract), rules);

        return tx.complianceEvaluation.create({
          data: {
            organizationId: tenant.organizationId,
            subjectType: "CONTRACT",
            contractId: contract.id,
            status: result.status,
            score: result.score,
            findings: result as unknown as object,
            ruleEngineVersion: COMPLIANCE_ENGINE_VERSION,
          },
        });
      },
    );
  }

  async listEvaluationsForContract(tenant: RequestTenantContext, contractId: string) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract) {
        throw new NotFoundException("Contract not found");
      }
      return tx.complianceEvaluation.findMany({
        where: { contractId },
        orderBy: { createdAt: "desc" },
      });
    });
  }
}
