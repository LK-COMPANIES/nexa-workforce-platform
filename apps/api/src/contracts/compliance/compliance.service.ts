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

  // Org-wide Compliance Health Index (brief §9). Counts each CONTRACT once,
  // using only its most recent evaluation — a contract re-evaluated five
  // times must not be counted five times. Contracts never evaluated at all
  // are surfaced separately (`neverEvaluated`) rather than silently omitted,
  // since "no data" and "evaluated and passing" are not the same thing.
  async getOrganizationComplianceSummary(tenant: RequestTenantContext) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const [allContracts, evaluations] = await Promise.all([
        tx.contract.findMany({ where: { organizationId: tenant.organizationId }, select: { id: true, title: true } }),
        tx.complianceEvaluation.findMany({
          where: { organizationId: tenant.organizationId, subjectType: "CONTRACT" },
          orderBy: { createdAt: "desc" },
          select: { contractId: true, status: true, createdAt: true },
        }),
      ]);

      const latestByContract = new Map<string, (typeof evaluations)[number]>();
      for (const evaluation of evaluations) {
        if (evaluation.contractId && !latestByContract.has(evaluation.contractId)) {
          latestByContract.set(evaluation.contractId, evaluation);
        }
      }

      const summary = { PASS: 0, WARNING: 0, FAIL: 0, REQUIRES_HUMAN_REVIEW: 0, neverEvaluated: 0 };
      const contractsRequiringReview: { id: string; title: string; status: string }[] = [];

      for (const contract of allContracts) {
        const latest = latestByContract.get(contract.id);
        if (!latest) {
          summary.neverEvaluated += 1;
          continue;
        }
        summary[latest.status] += 1;
        if (latest.status === "FAIL" || latest.status === "REQUIRES_HUMAN_REVIEW") {
          contractsRequiringReview.push({ id: contract.id, title: contract.title, status: latest.status });
        }
      }

      return {
        totalContracts: allContracts.length,
        evaluatedContracts: allContracts.length - summary.neverEvaluated,
        ...summary,
        contractsRequiringReview,
      };
    });
  }
}
