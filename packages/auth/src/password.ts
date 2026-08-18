import argon2 from "argon2";

// Argon2id: the OWASP/RFC 9106-recommended choice when you can't dedicate a
// fully isolated resource budget to hashing (argon2id resists both GPU
// cracking, like argon2i, and side-channel timing attacks, like argon2d).
// Parameters follow OWASP's current baseline recommendation for argon2id.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return argon2.hash(plainTextPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plainTextPassword);
  } catch {
    // argon2.verify throws on a malformed/foreign hash (e.g. a legacy bcrypt
    // hash) rather than returning false — treat that identically to a wrong
    // password rather than letting it surface as a 500.
    return false;
  }
}
