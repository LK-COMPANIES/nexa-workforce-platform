import type { PermissionKey } from "@nexa/types";

// UI-side permission checks are for NAVIGATION AND AFFORDANCE ONLY (brief
// §6: "Hiding a UI element is not authorization. The backend must remain
// authoritative.") Every action gated by these helpers is independently
// re-checked by the backend's PermissionsGuard on the actual API call — if
// this check and the backend ever disagreed, the backend wins, always.
export function hasPermission(permissions: PermissionKey[], required: PermissionKey): boolean {
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: PermissionKey[], required: PermissionKey[]): boolean {
  return required.some((permission) => permissions.includes(permission));
}

export function hasAllPermissions(permissions: PermissionKey[], required: PermissionKey[]): boolean {
  return required.every((permission) => permissions.includes(permission));
}
