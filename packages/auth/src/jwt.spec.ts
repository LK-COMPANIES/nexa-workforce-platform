import { signAccessToken, verifyAccessToken, type AccessTokenClaims, type TokenIssuerConfig } from "./jwt";

const config: TokenIssuerConfig = {
  secret: "test-secret-at-least-32-characters-long",
  issuer: "nexa-test-issuer",
  audience: "nexa-test-audience",
};

const claims: AccessTokenClaims = {
  sub: "user-1",
  organization_id: "org-1",
  session_id: "session-1",
  role_key: "client_admin",
  token_type: "access",
};

describe("access token sign/verify", () => {
  it("round-trips valid claims", () => {
    const token = signAccessToken(claims, config, "15m");
    const verified = verifyAccessToken(token, config);
    expect(verified.sub).toBe(claims.sub);
    expect(verified.organization_id).toBe(claims.organization_id);
    expect(verified.session_id).toBe(claims.session_id);
    expect(verified.role_key).toBe(claims.role_key);
    expect(verified.token_type).toBe("access");
  });

  it("rejects a token signed with a different secret (forgery)", () => {
    const token = signAccessToken(claims, config, "15m");
    const wrongConfig: TokenIssuerConfig = { ...config, secret: "a-completely-different-secret-value" };
    expect(() => verifyAccessToken(token, wrongConfig)).toThrow();
  });

  it("rejects a token issued for a different audience", () => {
    const token = signAccessToken(claims, config, "15m");
    const wrongAudience: TokenIssuerConfig = { ...config, audience: "some-other-audience" };
    expect(() => verifyAccessToken(token, wrongAudience)).toThrow();
  });

  it("rejects a token issued by a different issuer", () => {
    const token = signAccessToken(claims, config, "15m");
    const wrongIssuer: TokenIssuerConfig = { ...config, issuer: "some-other-issuer" };
    expect(() => verifyAccessToken(token, wrongIssuer)).toThrow();
  });

  it("rejects an already-expired token", () => {
    const token = signAccessToken(claims, config, -1); // expiresIn in the past
    expect(() => verifyAccessToken(token, config)).toThrow(/expired/i);
  });

  it("rejects a token whose alg the verifier wasn't told to trust (none-alg style tampering)", () => {
    const token = signAccessToken(claims, config, "15m");
    const [header, payload] = token.split(".");
    const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const forgedToken = `${forgedHeader}.${payload}.`;
    expect(() => verifyAccessToken(forgedToken, config)).toThrow();
    // sanity: original header really did differ, proving we tampered with something
    expect(header).not.toEqual(forgedHeader);
  });
});
