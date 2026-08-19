"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionKey } from "@nexa/types";
import { cn } from "@nexa/ui";
import { hasAnyPermission } from "../../lib/permissions";
import { NAV_ITEMS } from "./nav-config";

export function SidebarNav({ permissions }: { permissions: PermissionKey[] }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiresAnyPermission || hasAnyPermission(permissions, item.requiresAnyPermission),
  );

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
