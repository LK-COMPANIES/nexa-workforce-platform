import { assertPasswordPolicy, PasswordPolicyError } from "./password-policy";

describe("password policy", () => {
  it("accepts a sufficiently long password", () => {
    expect(() => assertPasswordPolicy("a-long-enough-passphrase")).not.toThrow();
  });

  it("rejects passwords shorter than 12 characters", () => {
    expect(() => assertPasswordPolicy("short1")).toThrow(PasswordPolicyError);
  });

  it("rejects passwords longer than 128 characters", () => {
    expect(() => assertPasswordPolicy("a".repeat(129))).toThrow(PasswordPolicyError);
  });

  it("rejects blank/whitespace-only passwords", () => {
    expect(() => assertPasswordPolicy("            ")).toThrow(PasswordPolicyError);
  });

  it("rejects common denylisted passwords case-insensitively", () => {
    expect(() => assertPasswordPolicy("PASSWORD123456")).toThrow(PasswordPolicyError);
  });

  it("collects multiple violations in one error", () => {
    try {
      assertPasswordPolicy("short");
      fail("expected assertPasswordPolicy to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PasswordPolicyError);
      expect((error as PasswordPolicyError).violations.length).toBeGreaterThan(0);
    }
  });
});
