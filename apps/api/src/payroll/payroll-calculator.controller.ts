import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { payrollCalculatorSchema, type PayrollCalculatorInput } from "@nexa/validation";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { PayrollService } from "./payroll.service";

// Deliberately separate from PayrollController (mounted at payroll/runs) —
// this is a read-only "what-if" tool, not a run lifecycle operation.
@Controller("payroll/calculator")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class PayrollCalculatorController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission("payroll:read")
  calculate(
    @Body(new ZodValidationPipe(payrollCalculatorSchema)) body: PayrollCalculatorInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.payrollService.calculatePreview(tenant, body);
  }
}
