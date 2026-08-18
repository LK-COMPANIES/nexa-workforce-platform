import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "@nexa/types";

export const PERMISSIONS_METADATA_KEY = "requiredPermissions";

// @RequirePermission('employee:read') — or multiple, all required:
// @RequirePermission('payroll:read', 'payroll:approve')
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
