import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function FeatureCard({
  icon: Icon,
  title,
  children,
  id,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02] transition-shadow hover:shadow-md hover:shadow-slate-900/[0.04]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
    </div>
  );
}
