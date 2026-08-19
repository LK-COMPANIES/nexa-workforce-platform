import { Badge, type BadgeProps } from "@nexa/ui";
import type { ComplianceStatus } from "../../types/api";

const STATUS_VARIANTS: Record<ComplianceStatus, NonNullable<BadgeProps["variant"]>> = {
  PASS: "success",
  WARNING: "warning",
  FAIL: "destructive",
  REQUIRES_HUMAN_REVIEW: "outline",
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  PASS: "Pass",
  WARNING: "Warning",
  FAIL: "Fail",
  REQUIRES_HUMAN_REVIEW: "Requires human review",
};

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
