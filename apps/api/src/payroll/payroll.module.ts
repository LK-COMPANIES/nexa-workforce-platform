import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { PayrollCalculationService } from "./payroll-calculation.service";
import { PayrollCalculatorController } from "./payroll-calculator.controller";
import { PayrollReportService } from "./payroll-report.service";
import { PayrollController } from "./payroll.controller";
import { PayrollRepository } from "./payroll.repository";
import { PayrollService } from "./payroll.service";
import { StatutoryRulesLoader } from "./statutory-rules.loader";

@Module({
  imports: [AuthModule, TenancyModule, AuthorizationModule],
  controllers: [PayrollController, PayrollCalculatorController],
  providers: [
    PayrollService,
    PayrollRepository,
    PayrollReportService,
    PayrollCalculationService,
    StatutoryRulesLoader,
  ],
})
export class PayrollModule {}
