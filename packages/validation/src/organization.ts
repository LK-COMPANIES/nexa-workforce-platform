import { z } from "zod";
import { ORGANIZATION_TYPES } from "@nexa/types";

export const createOrganizationSchema = z.object({
  type: z.enum(ORGANIZATION_TYPES),
  legalName: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  taxIdentifier: z.string().max(64).optional(),
  countryCode: z.string().length(2).default("KE"),
  parentOrganizationId: z.string().uuid().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema.partial();

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
