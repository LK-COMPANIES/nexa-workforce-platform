import { generateRefreshToken, hashRefreshToken, newTokenFamilyId } from "./refresh-token";

describe("refresh token generation", () => {
  it("generates a high-entropy raw token distinct from its hash", () => {
    const { raw, hash } = generateRefreshToken();
    expect(raw.length).toBeGreaterThanOrEqual(32);
    expect(hash).toHaveLength(64); // sha256 hex digest
    expect(raw).not.toEqual(hash);
  });

  it("hashing is deterministic (same input -> same hash)", () => {
    const { raw, hash } = generateRefreshToken();
    expect(hashRefreshToken(raw)).toEqual(hash);
  });

  it("generates unique tokens across calls", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toEqual(b.raw);
    expect(a.hash).not.toEqual(b.hash);
  });

  it("generates unique family ids", () => {
    expect(newTokenFamilyId()).not.toEqual(newTokenFamilyId());
  });
});
