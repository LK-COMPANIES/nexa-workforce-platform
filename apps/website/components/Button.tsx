import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20",
  secondary: "bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-sm shadow-accent-600/20",
  ghost: "text-slate-700 hover:text-brand-700 hover:bg-brand-50",
} as const;

const SIZES = {
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:pointer-events-none";

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
