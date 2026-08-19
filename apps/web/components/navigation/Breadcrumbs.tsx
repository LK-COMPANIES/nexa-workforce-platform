"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

function titleCase(segment: string): string {
  return segment
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm text-slate-500">
        <li>
          <Link href="/dashboard" className="hover:text-slate-900">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          return (
            <Fragment key={href}>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <li aria-current={isLast ? "page" : undefined}>
                {isLast ? (
                  <span className="font-medium text-slate-900">{titleCase(segment)}</span>
                ) : (
                  <Link href={href} className="hover:text-slate-900">
                    {titleCase(segment)}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
