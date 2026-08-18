import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { createPayrollRunSchema, voidPayrollRunSchema, type CreatePayrollRunInput, type VoidPayrollRunInput } from "@nexa/validation";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { PayrollReportService } from "./payroll-report.service";
import { PayrollService } from "./payroll.service";

const runIdParamSchema = z.string().uuid();

@Controller("payroll/runs")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly reportService: PayrollReportService,
  ) {}

  @Post()
  @RequirePermission("payroll:process")
  createRun(
    @Body(new ZodValidationPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.payrollService.createRun(tenant, body);
  }

  @Get()
  @RequirePermission("payroll:read")
  listRuns(@CurrentTenant() tenant: RequestTenantContext) {
    return this.payrollService.listRuns(tenant);
  }

  @Get(":id")
  @RequirePermission("payroll:read")
  getRun(@Param("id", new ZodValidationPipe(runIdParamSchema)) id: string, @CurrentTenant() tenant: RequestTenantContext) {
    return this.payrollService.getRun(tenant, id);
  }

  @Get(":id/records")
  @RequirePermission("payroll:read")
  getRunRecords(
    @Param("id", new ZodValidationPipe(runIdParamSchema)) id: string,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.payrollService.getRunRecords(tenant, id);
  }

  @Get(":id/summary")
  @RequirePermission("payroll:read")
  getRunSummary(
    @Param("id", new ZodValidationPipe(runIdParamSchema)) id: string,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.reportService.getRunSummary(tenant, id);
  }

  @Post(":id/calculate")
  @HttpCode(200)
  @RequirePermission("payroll:process")
  calculate(@Param("id", new ZodValidationPipe(runIdParamSchema)) id: string, @CurrentTenant() tenant: RequestTenantContext) {
    return this.payrollService.calculate(tenant, id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermission("payroll:approve")
  approve(@Param("id", new ZodValidationPipe(runIdParamSchema)) id: string, @CurrentTenant() tenant: RequestTenantContext) {
    return this.payrollService.approve(tenant, id);
  }

  @Post(":id/finalize")
  @HttpCode(200)
  @RequirePermission("payroll:approve")
  finalize(@Param("id", new ZodValidationPipe(runIdParamSchema)) id: string, @CurrentTenant() tenant: RequestTenantContext) {
    return this.payrollService.finalize(tenant, id);
  }

  @Post(":id/void")
  @HttpCode(200)
  @RequirePermission("payroll:approve")
  voidRun(
    @Param("id", new ZodValidationPipe(runIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(voidPayrollRunSchema)) body: VoidPayrollRunInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.payrollService.voidRun(tenant, id, body.reason);
  }
}
