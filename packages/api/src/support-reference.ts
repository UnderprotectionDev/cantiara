export const SUPPORT_REFERENCE_HEADER = "x-cantiara-support-reference";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUPPORT_REFERENCE_PATTERN =
  /^SUP-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

export const SUPPORT_FAILURE_REASON_CODES = [
  "offline",
  "restart-api",
  "schema-drift",
  "unexpected",
] as const;

export type SupportFailureReasonCode =
  (typeof SUPPORT_FAILURE_REASON_CODES)[number];

export const SUPPORT_WRITE_OUTCOMES = [
  "not-written",
  "unknown",
  "written",
] as const;

export type SupportWriteOutcome = (typeof SUPPORT_WRITE_OUTCOMES)[number];

export const SUPPORT_RETRY_POLICIES = ["never", "once"] as const;

export type SupportRetryPolicy = (typeof SUPPORT_RETRY_POLICIES)[number];

export interface SupportFailureData {
  reasonCode: SupportFailureReasonCode;
  retryPolicy: SupportRetryPolicy;
  supportReference: string;
  writeOutcome: SupportWriteOutcome;
}

export const SUPPORT_FAILURE_MESSAGES: Record<
  SupportFailureReasonCode,
  string
> = {
  offline: "You’re offline",
  "restart-api": "Please restart the API and try again.",
  "schema-drift": "Please restart after applying the latest migration.",
  unexpected: "This action could not be completed.",
};

export function supportFailureMessage(reasonCode: SupportFailureReasonCode) {
  return SUPPORT_FAILURE_MESSAGES[reasonCode];
}

export function isSupportReference(value: unknown): value is string {
  return typeof value === "string" && SUPPORT_REFERENCE_PATTERN.test(value);
}

export function isSafeTrackingRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createSupportReference(requestId?: string) {
  const safeRequestId = isSafeTrackingRequestId(requestId)
    ? requestId
    : crypto.randomUUID();
  return `SUP-${safeRequestId.toUpperCase()}`;
}

export function isSupportFailureReasonCode(
  value: unknown,
): value is SupportFailureReasonCode {
  return (
    typeof value === "string" &&
    SUPPORT_FAILURE_REASON_CODES.includes(value as SupportFailureReasonCode)
  );
}

export function isSupportWriteOutcome(
  value: unknown,
): value is SupportWriteOutcome {
  return (
    typeof value === "string" &&
    SUPPORT_WRITE_OUTCOMES.includes(value as SupportWriteOutcome)
  );
}

export function isSupportRetryPolicy(
  value: unknown,
): value is SupportRetryPolicy {
  return (
    typeof value === "string" &&
    SUPPORT_RETRY_POLICIES.includes(value as SupportRetryPolicy)
  );
}

export function isSupportFailureData(
  value: unknown,
): value is SupportFailureData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    isSupportFailureReasonCode(data.reasonCode) &&
    isSupportRetryPolicy(data.retryPolicy) &&
    isSupportReference(data.supportReference) &&
    isSupportWriteOutcome(data.writeOutcome)
  );
}
