import { createHash, randomBytes, randomUUID } from "node:crypto";

const RAW_TOKEN_BYTES = 32; // 256 bits of entropy

export interface GeneratedRefreshToken {
  /** Returned to the client exactly once. Never persisted, never logged. */
  raw: string;
  /** What's actually stored — sha256 of `raw`. See RefreshToken model docs
   * in schema.prisma for why a fast hash is the correct choice here. */
  hash: string;
}

export function generateRefreshToken(): GeneratedRefreshToken {
  const raw = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function newTokenFamilyId(): string {
  return randomUUID();
}
