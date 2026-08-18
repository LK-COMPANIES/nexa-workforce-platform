import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createContractSchema, updateContractSchema, type CreateContractInput, type UpdateContractInput } from "@nexa/validation";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { ComplianceService } from "./compliance/compliance.service";
import { ContractsService } from "./contracts.service";

const idParamSchema = z.string().uuid();

@Controller("contracts")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly complianceService: ComplianceService,
  ) {}

  @Post()
  @RequirePermission("contract:create")
  create(
    @Body(new ZodValidationPipe(createContractSchema)) body: CreateContractInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.contractsService.create(tenant, body);
  }

  @Get()
  @RequirePermission("contract:read")
  list(@CurrentTenant() tenant: RequestTenantContext) {
    return this.contractsService.list(tenant);
  }

  @Get(":id")
  @RequirePermission("contract:read")
  get(@Param("id", new ZodValidationPipe(idParamSchema)) id: string, @CurrentTenant() tenant: RequestTenantContext) {
    return this.contractsService.getOrThrow(tenant, id);
  }

  @Patch(":id")
  @RequirePermission("contract:update")
  update(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateContractSchema)) body: UpdateContractInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.contractsService.update(tenant, id, body);
  }

  // Compliance pipeline (brief §32): a contract is evaluated on demand
  // (typically triggered after create/update by a caller) rather than
  // implicitly on every read — evaluation is a deliberate, auditable act
  // that produces a new append-only ComplianceEvaluation row, not a
  // side-effect of viewing the contract.
  @Post(":id/compliance/evaluate")
  @RequirePermission("contract:update")
  evaluateCompliance(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.complianceService.evaluateContract(tenant, id);
  }

  @Get(":id/compliance")
  @RequirePermission("contract:read")
  listCompliance(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    return this.complianceService.listEvaluationsForContract(tenant, id);
  }
}
