import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { ComplianceService } from "./compliance/compliance.service";
import { EmploymentActRulesLoader } from "./compliance/employment-act-rules.loader";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [AuthModule, TenancyModule, AuthorizationModule],
  controllers: [ContractsController],
  providers: [ContractsService, ComplianceService, EmploymentActRulesLoader],
})
export class ContractsModule {}
