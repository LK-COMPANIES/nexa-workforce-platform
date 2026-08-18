import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";

// Access-token claims are deliberately narrow: identity + the single
// (organization, session) pair the token is scoped to + a role reference for
// logging/UI. Note what is NOT here: a permissions array. Phase 1 embedded
// one and trusted it for the token's whole lifetime; Phase 2 requires
// re-validating live OrganizationMembership + current permissions on every
// request (see apps/api's TenantContextGuard/PermissionsGuard), so caching
// permissions in the token would just be a stale, unenforceable claim.
export interface AccessTokenClaims {
  sub: string; // user id
  organization_id: string;
  session_id: string;
  role_key: string;
  token_type: "access";
}

export interface TokenIssuerConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export function signAccessToken(
  claims: AccessTokenClaims,
  config: TokenIssuerConfig,
  expiresIn: string | number,
): string {
  return jwt.sign(claims, config.secret, {
    expiresIn,
    algorithm: "HS256",
    issuer: config.issuer,
    audience: config.audience,
  } as SignOptions);
}

export function verifyAccessToken(token: string, config: TokenIssuerConfig): AccessTokenClaims {
  const options: VerifyOptions = {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.audience,
  };
  const claims = jwt.verify(token, config.secret, options) as AccessTokenClaims;
  if (claims.token_type !== "access") {
    throw new Error("Token is not an access token");
  }
  return claims;
}
