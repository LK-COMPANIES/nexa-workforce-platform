import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { prisma, runWithTenant, type RunWithTenantOptions, type TenantContext } from "@nexa/database";
import type { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  /**
   * Raw, non-tenant-scoped client. Only safe for: platform-global reference
   * data (roles, permissions, statutory jurisdictions), the health check,
   * and the RLS-bypassing `auth_lookup_user_by_email` SQL function used
   * during login. Every other query MUST go through `runWithTenant`.
   */
  readonly client: PrismaClient = prisma;

  async runWithTenant<T>(
    context: TenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: RunWithTenantOptions,
  ): Promise<T> {
    return runWithTenant(this.client, context, fn, options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
