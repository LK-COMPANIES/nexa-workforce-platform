import { PrismaClient } from "@prisma/client";

// Standard singleton pattern to avoid exhausting the Postgres connection pool
// under dev-server hot-reload (each reload would otherwise instantiate a new
// PrismaClient without closing the previous one).
declare global {
  // eslint-disable-next-line no-var
  var __nexaPrismaClient: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__nexaPrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__nexaPrismaClient = prisma;
}
