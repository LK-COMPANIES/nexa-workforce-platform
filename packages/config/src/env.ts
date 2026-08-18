import { z } from "zod";

// -----------------------------------------------------------------------------
// Centralized, per-runtime environment validation. Each `load*Env` function
// parses `process.env` against a strict schema and throws a single,
// aggregated, readable error listing every missing/invalid variable if
// validation fails — the process must not start with incomplete config.
//
// Server-only secrets (DB credentials, JWT secrets, Anthropic API key) are
// deliberately absent from webEnvSchema's NEXT_PUBLIC_* surface: Next.js only
// inlines `NEXT_PUBLIC_`-prefixed variables into the browser bundle, and this
// schema enforces that boundary by only ever reading server-side variables
// without that prefix into server-only config.
// -----------------------------------------------------------------------------

const nodeEnvSchema = z.enum(["development", "test", "production"]);

function formatZodError(error: z.ZodError, context: string): Error {
  const issues = error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return new Error(`Invalid environment configuration for ${context}:\n${issues}`);
}

// ---- apps/api (NestJS) ------------------------------------------------------

const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  WEB_APP_URL: z.string().url(),
  AI_SERVICE_URL: z.string().url(),

  STORAGE_PROVIDER: z.enum(["s3"]).default("s3"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    throw formatZodError(result.error, "apps/api");
  }
  return result.data;
}

// ---- apps/web (Next.js) — server-side config only --------------------------

const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  // Browser-reachable API origin — inlined into the client bundle.
  NEXT_PUBLIC_API_URL: z.string().url(),
  // Server-only: the API's address as reachable from inside the web
  // container's own network (e.g. Docker service DNS). Falls back to
  // NEXT_PUBLIC_API_URL for non-containerized local dev, where both
  // processes share localhost. Never exposed to the browser.
  API_INTERNAL_URL: z.string().url().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    throw formatZodError(result.error, "apps/web");
  }
  return result.data;
}

// ---- Database bootstrap (packages/database/prisma/seed.ts) -----------------
//
// The initial Nexa super-admin account is created ONLY when
// AUTH_BOOTSTRAP_ENABLED=true, and only from credentials read from the
// environment — never hard-coded. The password has no default: if bootstrap
// is enabled and the password isn't set, this throws rather than seeding
// with an absent/weak credential.

const bootstrapAdminEnvSchema = z
  .object({
    AUTH_BOOTSTRAP_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NEXA_BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    NEXA_BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.AUTH_BOOTSTRAP_ENABLED) {
      return;
    }
    if (!value.NEXA_BOOTSTRAP_ADMIN_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXA_BOOTSTRAP_ADMIN_EMAIL"],
        message: "required when AUTH_BOOTSTRAP_ENABLED=true",
      });
    }
    if (!value.NEXA_BOOTSTRAP_ADMIN_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXA_BOOTSTRAP_ADMIN_PASSWORD"],
        message: "required when AUTH_BOOTSTRAP_ENABLED=true (no default is provided, by design)",
      });
    }
  });

export type BootstrapAdminConfig = z.infer<typeof bootstrapAdminEnvSchema>;

export function loadBootstrapAdminConfig(
  source: NodeJS.ProcessEnv = process.env,
): BootstrapAdminConfig {
  const result = bootstrapAdminEnvSchema.safeParse(source);
  if (!result.success) {
    throw formatZodError(result.error, "database bootstrap (AUTH_BOOTSTRAP_ENABLED)");
  }
  return result.data;
}
