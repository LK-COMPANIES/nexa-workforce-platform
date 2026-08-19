import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@nexa/ui";

// brief §24: never a blank screen. Every list/table page renders this
// instead of silently showing nothing when there is genuinely no data yet.
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Icon className="h-10 w-10 text-slate-300" aria-hidden />
        <div>
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
