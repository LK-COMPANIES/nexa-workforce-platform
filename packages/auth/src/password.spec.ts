import { hashPassword, verifyPassword } from "./password";

describe("password hashing (Argon2id)", () => {
  it("produces an argon2id hash", async () => {
    const hash = await hashPassword("a-reasonably-strong-passphrase");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password-entirely", hash)).resolves.toBe(false);
  });

  it("rejects against a malformed/foreign hash instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-input-password"),
      hashPassword("same-input-password"),
    ]);
    expect(a).not.toEqual(b);
  });
});
