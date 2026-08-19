"use client";

import { LogOut, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nexa/ui";
import { logoutAction } from "../../lib/auth/actions";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function UserMenu({
  firstName,
  lastName,
  email,
  roleName,
}: {
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${firstName} ${lastName}`}
        className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <Avatar>
          <AvatarFallback>{initials(firstName, lastName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium text-slate-900">
              {firstName} {lastName}
            </span>
            <span className="text-xs font-normal text-slate-500">{email}</span>
            <span className="mt-1 text-xs font-normal text-slate-400">{roleName}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/organizations" className="flex items-center gap-2">
            <User className="h-4 w-4" aria-hidden />
            My organization
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <button type="submit" className="w-full">
            <DropdownMenuItem asChild>
              <span className="flex items-center gap-2 text-red-600">
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
