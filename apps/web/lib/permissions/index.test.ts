import type { PermissionKey } from "@nexa/types";
import { hasAllPermissions, hasAnyPermission, hasPermission } from "./index";

const READ = "payroll:read" as PermissionKey;
const APPROVE = "payroll:approve" as PermissionKey;
const CREATE = "contract:create" as PermissionKey;

describe("hasPermission", () => {
  it("returns true when the permission is present", () => {
    expect(hasPermission([READ, APPROVE], READ)).toBe(true);
  });

  it("returns false when the permission is absent", () => {
    expect(hasPermission([READ], APPROVE)).toBe(false);
  });

  it("returns false for an empty permission set", () => {
    expect(hasPermission([], READ)).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true if at least one required permission is present", () => {
    expect(hasAnyPermission([READ], [APPROVE, READ])).toBe(true);
  });

  it("returns false if none of the required permissions are present", () => {
    expect(hasAnyPermission([READ], [APPROVE, CREATE])).toBe(false);
  });

  it("returns false when required is empty", () => {
    expect(hasAnyPermission([READ, APPROVE], [])).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true only when every required permission is present", () => {
    expect(hasAllPermissions([READ, APPROVE, CREATE], [READ, APPROVE])).toBe(true);
  });

  it("returns false when at least one required permission is missing", () => {
    expect(hasAllPermissions([READ], [READ, APPROVE])).toBe(false);
  });

  it("returns true vacuously when required is empty", () => {
    expect(hasAllPermissions([], [])).toBe(true);
  });
});
