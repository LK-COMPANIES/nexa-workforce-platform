// Mirrors AIRequestStatus / AIReviewDecision in schema.prisma.
export const AI_REQUEST_STATUSES = ["PENDING", "SUCCESS", "FAILURE", "REJECTED"] as const;
export type AIRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

export const AI_REVIEW_DECISIONS = ["APPROVED", "REJECTED", "NOT_REQUIRED"] as const;
export type AIReviewDecision = (typeof AI_REVIEW_DECISIONS)[number];

// AIAuditLog.inputRef / outputRef are pointers (object-storage keys or content
// hashes), never raw prompt/document content — this type documents that
// contract for callers constructing audit log entries.
export interface AIContentRef {
  /** e.g. "s3://nexa-ai-artifacts/{orgId}/{uuid}.json" or a content hash */
  pointer: string;
  /** how to interpret `pointer` */
  kind: "object_storage_key" | "content_hash";
}
