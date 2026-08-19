import type { ComponentType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";

export function StatCard({
  icon: Icon,
  label,
  value,
  helpText,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  helpText?: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

// brief §10: divisions without a real backend data source must say so
// explicitly, never show a fabricated number.
export function NoOperationalData() {
  return <p className="text-sm text-slate-400">No operational data available</p>;
}
