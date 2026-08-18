import { z } from "zod";

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1).max(64),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  workEmail: z.string().email().optional(),
  phone: z.string().max(32).optional(),
  nationalIdNumber: z.string().max(64).optional(),
  dateOfBirth: z.coerce.date().optional(),
  hireDate: z.coerce.date(),
  userId: z.string().uuid().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
