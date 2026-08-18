import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { RequestTenantContext } from "../tenancy/types";
import type { PrismaService } from "../prisma/prisma.service";
import { PayrollRepository } from "./payroll.repository";

const tenant: RequestTenantContext = {
  userId: "user-1",
  organizationId: "org-1",
  sessionId: "session-1",
  roleKey: "hr_manager",
  permissions: [],
  isSuperAdminSession: false,
};

describe("PayrollRepository.createRun — idempotency (brief §21)", () => {
  it("translates a duplicate-run unique-constraint violation into a 409 Conflict, not a raw 500", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    const prisma = {
      runWithTenant: jest.fn().mockRejectedValue(p2002),
    } as unknown as PrismaService;
    const repository = new PayrollRepository(prisma);

    await expect(
      repository.createRun(tenant, {
        payrollPeriodStart: new Date("2026-01-01"),
        payrollPeriodEnd: new Date("2026-01-31"),
        runType: "REGULAR",
        currency: "KES",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("does not mask an unrelated database error as a conflict", async () => {
    const otherError = new Error("connection reset");
    const prisma = {
      runWithTenant: jest.fn().mockRejectedValue(otherError),
    } as unknown as PrismaService;
    const repository = new PayrollRepository(prisma);

    await expect(
      repository.createRun(tenant, {
        payrollPeriodStart: new Date("2026-01-01"),
        payrollPeriodEnd: new Date("2026-01-31"),
        runType: "REGULAR",
        currency: "KES",
      }),
    ).rejects.toThrow("connection reset");
  });
});
