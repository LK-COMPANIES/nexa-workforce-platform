import type { HTMLAttributes } from "react";
import { cn } from "./cn";

// Loading-state placeholder (brief §24: never a blank screen, never a fake
// value that resembles real data) — a pulse block, never a fabricated
// number like "KES 0" that could be mistaken for a real figure.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200", className)} {...props} />;
}
