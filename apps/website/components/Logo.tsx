import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 font-display text-sm font-bold text-white">
        N
      </span>
      <span className="font-display text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
        Nexa Workforce
        <span className="block text-[11px] font-medium tracking-wide text-slate-500">SOLUTIONS</span>
      </span>
    </Link>
  );
}
