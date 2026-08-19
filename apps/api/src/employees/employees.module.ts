import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { EmployeesController } from "./employees.controller";

@Module({
  imports: [AuthModule, TenancyModule, AuthorizationModule],
  controllers: [EmployeesController],
})
export class EmployeesModule {}
