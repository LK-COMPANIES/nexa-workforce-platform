import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentAccessToken } from "../tenancy/current-access-token.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import { AiService } from "./ai.service";

const idParamSchema = z.string().uuid();

// Triggers and polls AI-agent work in apps/ai. Deliberately does NOT take
// @CurrentTenant() and pass organization_id through in any request body to
// apps/ai — only the caller's own verified access token is forwarded (see
// CurrentAccessToken()), so apps/ai derives tenant scope exactly the way it
// would for any other caller, independent of anything apps/api asserts.
@Controller()
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("contracts/:id/ai-audit")
  @RequirePermission("contract:update")
  requestContractAudit(
    @Param("id", new ZodValidationPipe(idParamSchema)) id: string,
    @CurrentAccessToken() accessToken: string,
  ) {
    return this.aiService.requestContractAudit(accessToken, id);
  }

  @Get("ai/jobs/:jobId")
  @RequirePermission("contract:read")
  getJobStatus(
    @Param("jobId", new ZodValidationPipe(idParamSchema)) jobId: string,
    @CurrentAccessToken() accessToken: string,
  ) {
    return this.aiService.getJobStatus(accessToken, jobId);
  }
}
