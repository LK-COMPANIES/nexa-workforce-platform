import { Badge, type BadgeProps } from "@nexa/ui";
import type { PayrollRunStatus } from "../../types/api";

const STATUS_VARIANTS: Record<PayrollRunStatus, NonNullable<BadgeProps["variant"]>> = {
  DRAFT: "secondary",
  CALCULATING: "outline",
  CALCULATED: "outline",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  FINALIZED: "success",
  VOIDED: "destructive",
  FAILED: "destructive",
};

export function PayrollStatusBadge({ status }: { status: PayrollRunStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status.replace(/_/g, " ")}</Badge>;
}
