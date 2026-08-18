// Length-based policy, not arbitrary composition rules (require an
// uppercase/digit/symbol, etc.) — this follows NIST SP 800-63B, which found
// composition rules push users toward predictable patterns ("Passw0rd!")
// without meaningfully raising guessing resistance, whereas length is the
// dominant factor in entropy. A denylist of common passwords is the
// complementary control 800-63B actually recommends.
//
// Production extension point: this denylist is illustrative, not a real
// breached-password defense. A production deployment should check against a
// real corpus (e.g. the HaveIBeenPwned k-anonymity range API) instead of —
// or in addition to — this local list.
const MIN_LENGTH = 12;
const MAX_LENGTH = 128; // defends against hashing-cost DoS from pathological input sizes

const COMMON_PASSWORD_DENYLIST = new Set([
  "password123456",
  "123456789012",
  "qwertyuiopasdf",
  "letmein1234567",
  "changeme123456",
  "administrator1",
]);

export class PasswordPolicyError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Password does not meet policy requirements: ${violations.join("; ")}`);
    this.name = "PasswordPolicyError";
  }
}

export function assertPasswordPolicy(password: string): void {
  const violations: string[] = [];

  if (password.length < MIN_LENGTH) {
    violations.push(`must be at least ${MIN_LENGTH} characters`);
  }
  if (password.length > MAX_LENGTH) {
    violations.push(`must be at most ${MAX_LENGTH} characters`);
  }
  if (password.trim().length === 0) {
    violations.push("must not be blank");
  }
  if (COMMON_PASSWORD_DENYLIST.has(password.toLowerCase())) {
    violations.push("is a commonly used password");
  }

  if (violations.length > 0) {
    throw new PasswordPolicyError(violations);
  }
}
