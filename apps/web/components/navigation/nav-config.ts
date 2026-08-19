import type { PermissionKey } from "@nexa/types";
import { LayoutDashboard, Wallet, FileText, Building2 } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Any ONE of these permissions is sufficient to show the item. Omit for always-visible items. */
  requiresAnyPermission?: PermissionKey[];
}

// Permission-aware only for AFFORDANCE (brief §6) — the backend independently
// re-checks every request regardless of what's shown here.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Payroll", href: "/payroll", icon: Wallet, requiresAnyPermission: ["payroll:read"] },
  { label: "Contracts", href: "/contracts", icon: FileText, requiresAnyPermission: ["contract:read"] },
  {
    label: "Organization",
    href: "/organizations",
    icon: Building2,
    requiresAnyPermission: ["organization:read"],
  },
];
