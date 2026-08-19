"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import type { PermissionKey } from "@nexa/types";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@nexa/ui";
import { Breadcrumbs } from "../navigation/Breadcrumbs";
import { OrgSwitcher } from "../navigation/OrgSwitcher";
import { SidebarNav } from "../navigation/Sidebar";
import { UserMenu } from "../navigation/UserMenu";
import type { MembershipSummary } from "../../types/api";

export interface AppShellSession {
  organizationDisplayName: string;
  permissions: PermissionKey[];
  memberships: MembershipSummary[];
  user: { firstName: string; lastName: string; email: string };
  roleName: string;
}

export function AppShell({ session, children }: { session: AppShellSession; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-slate-900">Nexa Workforce Solutions</span>
        </div>
        <div className="border-b border-slate-200 p-3">
          <OrgSwitcher currentOrganizationName={session.organizationDisplayName} memberships={session.memberships} />
        </div>
        <SidebarNav permissions={session.permissions} />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b border-slate-200 p-4">
            <SheetTitle>Nexa Workforce Solutions</SheetTitle>
          </SheetHeader>
          <div className="border-b border-slate-200 p-3">
            <OrgSwitcher
              currentOrganizationName={session.organizationDisplayName}
              memberships={session.memberships}
            />
          </div>
          <SidebarNav permissions={session.permissions} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <div className="flex-1">
            <Breadcrumbs />
          </div>
          <UserMenu
            firstName={session.user.firstName}
            lastName={session.user.lastName}
            email={session.user.email}
            roleName={session.roleName}
          />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
