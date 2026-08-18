import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreateContractInput, UpdateContractInput } from "@nexa/validation";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestTenantContext } from "../tenancy/types";

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenant: RequestTenantContext, input: CreateContractInput) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
      tx.contract.create({
        data: {
          organizationId: tenant.organizationId,
          employeeId: input.employeeId,
          contractType: input.contractType,
          title: input.title,
          referenceCode: input.referenceCode,
          effectiveDate: input.effectiveDate,
          expirationDate: input.expirationDate,
          baseCompensation: input.baseCompensation,
          currency: input.currency,
          paymentInterval: input.paymentInterval,
          jobTitle: input.jobTitle,
          jobDescription: input.jobDescription,
          workLocation: input.workLocation,
          workingHoursPerWeek: input.workingHoursPerWeek,
          probationMonths: input.probationMonths,
          probationExtendedMonths: input.probationExtendedMonths,
          probationExtensionConsent: input.probationExtensionConsent,
          noticePeriodDays: input.noticePeriodDays,
          continuousEmploymentDate: input.continuousEmploymentDate,
          terms: input.terms as unknown as Prisma.InputJsonValue,
          documentStorageKey: input.documentStorageKey,
        },
      }),
    );
  }

  async list(tenant: RequestTenantContext) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
      tx.contract.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getOrThrow(tenant: RequestTenantContext, contractId: string) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const contract = await tx.contract.findUnique({ where: { id: contractId } });
      if (!contract) {
        throw new NotFoundException("Contract not found");
      }
      return contract;
    });
  }

  async update(tenant: RequestTenantContext, contractId: string, input: UpdateContractInput) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const existing = await tx.contract.findUnique({ where: { id: contractId } });
      if (!existing) {
        throw new NotFoundException("Contract not found");
      }
      return tx.contract.update({
        where: { id: contractId },
        data: {
          ...input,
          terms: input.terms !== undefined ? (input.terms as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
    });
  }
}
