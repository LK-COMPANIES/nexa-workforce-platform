import { Injectable } from "@nestjs/common";
import type { $Enums, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestMetadata } from "../common/request-metadata.util";

export interface RecordAuditEventInput {
  organizationId: string;
  actingUserId?: string | null;
  sessionId?: string | null;
  eventType: $Enums.AuthEventType;
  meta?: RequestMetadata;
  /** Small, structured, non-sensitive context only — NEVER passwords, raw tokens, or full headers. */
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuthAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.runWithTenant(
      { tenantId: input.organizationId, userId: input.actingUserId ?? undefined },
      (tx) =>
        tx.authenticationAuditEvent.create({
          data: {
            organizationId: input.organizationId,
            actingUserId: input.actingUserId ?? undefined,
            sessionId: input.sessionId ?? undefined,
            eventType: input.eventType,
            ipAddress: input.meta?.ip,
            userAgent: input.meta?.userAgent?.slice(0, 512),
            metadata: input.metadata,
          },
        }),
    );
  }
}
