import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiConfigService } from "../config/config.service";
import { parseDurationToMs } from "./duration.util";

export interface CreateSessionParams {
  userId: string;
  organizationId: string;
  isSuperAdminSession: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  constructor(private readonly config: ApiConfigService) {}

  /** Must be called with a `tx` already scoped to `params.organizationId` via runWithTenant(). */
  createSession(tx: Prisma.TransactionClient, params: CreateSessionParams) {
    const expiresAt = new Date(Date.now() + parseDurationToMs(this.config.env.JWT_REFRESH_TTL));
    return tx.session.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        isSuperAdminSession: params.isSuperAdminSession,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent?.slice(0, 512),
        expiresAt,
      },
    });
  }
}
