// Decodes a JWT's payload WITHOUT verifying its signature. This is safe
// specifically because it is never used for an authorization decision — the
// backend re-verifies signature/issuer/audience/expiry on every single
// request regardless (see apps/api's JwtAuthGuard + TenantContextGuard).
// This is purely a UX optimization: middleware uses `exp` to decide whether
// to proactively refresh before a page renders, so the user doesn't see a
// flash of "session expired." Edge-runtime safe (no Node `Buffer`/crypto).
export interface DecodedAccessTokenClaims {
  sub: string;
  organization_id: string;
  session_id: string;
  role_key: string;
  token_type: string;
  exp: number;
  iat: number;
}

export function decodeJwtPayloadUnsafe(token: string): DecodedAccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as DecodedAccessTokenClaims;
  } catch {
    return null;
  }
}

/** True if the token expires within `bufferSeconds` (default 30s) or is already expired/unparsable. */
export function isTokenExpiringSoon(token: string, bufferSeconds = 30): boolean {
  const claims = decodeJwtPayloadUnsafe(token);
  if (!claims?.exp) {
    return true;
  }
  return claims.exp * 1000 <= Date.now() + bufferSeconds * 1000;
}
