import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { generateRefreshToken, newTokenFamilyId } from "@nexa/auth";
import { ApiConfigService } from "../config/config.service";
import { parseDurationToMs } from "./duration.util";

@Injectable()
export class RefreshTokenService {
  constructor(private readonly config: ApiConfigService) {}

  /** Issues the first token in a new rotation family (at login). */
  issueInitial(tx: Prisma.TransactionClient, sessionId: string) {
    return this.issue(tx, sessionId, newTokenFamilyId());
  }

  /** Issues the next token in an existing rotation family (at refresh). */
  async issue(tx: Prisma.TransactionClient, sessionId: string, familyId: string) {
    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + parseDurationToMs(this.config.env.JWT_REFRESH_TTL));
    const record = await tx.refreshToken.create({
      data: { sessionId, familyId, tokenHash: hash, expiresAt },
    });
    return { raw, record };
  }
}
