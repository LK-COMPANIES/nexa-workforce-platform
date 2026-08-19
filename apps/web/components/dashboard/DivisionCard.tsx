import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { NoOperationalData } from "./StatCard";

// One of Nexa's nine operational divisions (brief §10). Renders real
// backend-sourced content when `children` is supplied; otherwise the
// explicit "No operational data available" state — never a placeholder
// number. The architecture (a plain content slot) is exactly what lets a
// division "plug into the executive intelligence layer later" per brief's
// own wording: giving it a real data source later requires no restructuring
// here, just passing `children`.
export function DivisionCard({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-700">{name}</CardTitle>
      </CardHeader>
      <CardContent>{children ?? <NoOperationalData />}</CardContent>
    </Card>
  );
}
