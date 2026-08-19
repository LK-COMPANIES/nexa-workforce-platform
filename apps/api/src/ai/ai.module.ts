import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [AuthModule, TenancyModule, AuthorizationModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
