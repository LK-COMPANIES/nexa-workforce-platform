import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationId: z.string().uuid(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Registration is client-organization onboarding, not bare account
// creation: it atomically creates a new CLIENT Organization, its first
// user, and grants that user Client_Admin — never a platform role. See
// apps/api/src/auth/auth.service.ts#register.
export const registerClientOrganizationSchema = z.object({
  organization: z.object({
    legalName: z.string().min(1).max(255),
    displayName: z.string().min(1).max(255),
    countryCode: z.string().length(2).default("KE"),
    taxIdentifier: z.string().max(64).optional(),
  }),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(12).max(128, "Password must be between 12 and 128 characters"),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().max(32).optional(),
  }),
});

export type RegisterClientOrganizationInput = z.infer<typeof registerClientOrganizationSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(2048),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

export const switchOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
});

export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
