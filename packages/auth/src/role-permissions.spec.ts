import { SYSTEM_ROLE_KEYS } from "@nexa/types";
import { ROLE_PERMISSION_MAP, roleHasPermission } from "./role-permissions";

describe("role permission matrix — least privilege", () => {
  it("defines a permission set for every system role", () => {
    for (const roleKey of SYSTEM_ROLE_KEYS) {
      expect(ROLE_PERMISSION_MAP[roleKey]).toBeDefined();
    }
  });

  it("grants the employee role zero permissions by default", () => {
    expect(ROLE_PERMISSION_MAP.employee).toEqual([]);
  });

  it("does not grant platform:* permissions to any non-super-admin role", () => {
    for (const roleKey of SYSTEM_ROLE_KEYS) {
      if (roleKey === "nexa_super_admin") continue;
      const grants = ROLE_PERMISSION_MAP[roleKey];
      expect(grants).not.toEqual(expect.arrayContaining(["platform:manage_organizations"]));
      expect(grants).not.toEqual(expect.arrayContaining(["platform:manage_roles"]));
    }
  });

  it("separates payroll processing from payroll approval for hr_manager (separation of duties)", () => {
    expect(roleHasPermission("hr_manager", "payroll:process")).toBe(true);
    expect(roleHasPermission("hr_manager", "payroll:approve")).toBe(false);
  });

  it("does not grant bpo_agent any organization/contract/payroll visibility", () => {
    const grants = ROLE_PERMISSION_MAP.bpo_agent;
    expect(grants).toEqual(["employee:read"]);
  });

  it("does not let client_admin manage platform-wide roles or other organizations", () => {
    const grants = ROLE_PERMISSION_MAP.client_admin;
    expect(grants).not.toContain("platform:manage_organizations");
    expect(grants).not.toContain("platform:manage_roles");
  });
});
