import ms from "ms";

// Converts a JWT-style duration string ("15m", "7d") to milliseconds, for
// computing Session/RefreshToken.expiresAt. jsonwebtoken parses these
// strings internally for token exp claims, but gives no way to reuse that
// parsing for our own DB timestamps — `ms` is the same library jsonwebtoken
// itself depends on, so behavior is guaranteed consistent.
type MsStringValue = Parameters<typeof ms>[0];

export function parseDurationToMs(duration: string): number {
  const value = ms(duration as MsStringValue);
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid duration string: "${duration}"`);
  }
  return value;
}
