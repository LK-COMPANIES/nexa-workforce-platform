import { Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsController } from "./organizations.controller";

@Module({
  imports: [AuthModule, TenancyModule, AuthorizationModule],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
