import {
  isSupportFailureReasonCode,
  isSupportReference,
  isSupportRetryPolicy,
  isSupportWriteOutcome,
  type SupportFailureReasonCode,
  type SupportRetryPolicy,
  type SupportWriteOutcome,
  supportFailureMessage,
} from "@cantiara/api/support-reference";

const OFFLINE_ERROR_PATTERN =
  /\b(?:failed to fetch|network request failed|networkerror|offline|load failed)\b/i;
const SCHEMA_DRIFT_ERROR_PATTERN =
  /\b(?:42p01|42703)\b|(?:relation|column)\b[\s\S]{0,160}\bdoes not exist\b|\bcurrent[_ ]schema\b/i;
const UNMATCHED_RPC_ERROR_PATTERN = /\b(?:404\s+not\s+found|not found)\b/i;
const UPDATE_REQUIRED_ERROR_PATTERN =
  /\b(?:update_required|update required)\b/i;

export type SupportReferenceFailureKind = "mutation" | "query";

export interface SupportReferenceFailure {
  canRetry: boolean;
  duration: number;
  reason: string;
  reasonCode: SupportFailureReasonCode;
  retryBound: string;
  retryPolicy: SupportRetryPolicy;
  supportReference: string | null;
  writeOutcome: SupportWriteOutcome;
  writeOutcomeLabel: string;
}

export interface BuildSupportReferenceFailureOptions {
  kind: SupportReferenceFailureKind;
  retryCount?: number;
  writeOutcome?: SupportWriteOutcome;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorSignals(
  error: unknown,
  seen = new Set<object>(),
  depth = 0,
): string {
  if (depth > 4 || !isRecord(error) || seen.has(error)) {
    return "";
  }
  seen.add(error);

  const signals: string[] = [];
  if (error instanceof Error) {
    signals.push(error.name, error.message);
  } else {
    for (const key of ["code", "message", "status"]) {
      const value = error[key];
      if (typeof value === "string" || typeof value === "number") {
        signals.push(String(value));
      }
    }
  }

  if ("cause" in error) {
    signals.push(errorSignals(error.cause, seen, depth + 1));
  }
  return signals.join(" ");
}

function errorData(error: unknown) {
  if (!(isRecord(error) && isRecord(error.data))) {
    return;
  }
  return error.data;
}

export function isOfflineTransportFailure(error: unknown) {
  return OFFLINE_ERROR_PATTERN.test(errorSignals(error));
}

function readReasonCode(
  error: unknown,
  data: Record<string, unknown> | undefined,
) {
  if (isSupportFailureReasonCode(data?.reasonCode)) {
    return data.reasonCode;
  }

  const signals = errorSignals(error);
  if (isOfflineTransportFailure(error)) {
    return "offline";
  }
  if (SCHEMA_DRIFT_ERROR_PATTERN.test(signals)) {
    return "schema-drift";
  }
  if (
    (isRecord(error) && (error.code === "NOT_FOUND" || error.status === 404)) ||
    UNMATCHED_RPC_ERROR_PATTERN.test(signals)
  ) {
    return "restart-api";
  }
  if (
    (isRecord(error) &&
      (error.code === "UPDATE_REQUIRED" || error.status === 426)) ||
    UPDATE_REQUIRED_ERROR_PATTERN.test(signals)
  ) {
    return "update-required";
  }
  return "unexpected";
}

export function supportWriteOutcomeLabel(writeOutcome: SupportWriteOutcome) {
  switch (writeOutcome) {
    case "not-written":
      return "Data was not written.";
    case "written":
      return "Data was written.";
    case "unknown":
      return "Data write outcome is unknown.";
    default:
      return "Data write outcome is unknown.";
  }
}

export function supportRetryBound(canRetry: boolean) {
  return canRetry ? "You can retry once." : "Do not retry.";
}

function failureMessage(
  error: unknown,
  reasonCode: SupportFailureReasonCode,
  kind: SupportReferenceFailureKind,
) {
  const data = errorData(error);
  if (kind === "mutation" && data?.code === "STALE_BASE_REVISION") {
    return "This page is out of date.";
  }
  return supportFailureMessage(reasonCode);
}

function resolveWriteOutcome(
  requestedWriteOutcome: SupportWriteOutcome | undefined,
  data: Record<string, unknown> | undefined,
  kind: SupportReferenceFailureKind,
) {
  if (isSupportWriteOutcome(data?.writeOutcome)) {
    return kind === "query" && data.writeOutcome === "unknown"
      ? "not-written"
      : data.writeOutcome;
  }
  if (isSupportWriteOutcome(requestedWriteOutcome)) {
    return requestedWriteOutcome;
  }
  return kind === "query" ? "not-written" : "unknown";
}

export function buildSupportReferenceFailure(
  error: unknown,
  {
    kind,
    retryCount = 0,
    writeOutcome: requestedWriteOutcome,
  }: BuildSupportReferenceFailureOptions,
): SupportReferenceFailure {
  const data = errorData(error);
  const reasonCode = readReasonCode(error, data);
  const supportReference = isSupportReference(data?.supportReference)
    ? data.supportReference
    : null;
  const writeOutcome = resolveWriteOutcome(requestedWriteOutcome, data, kind);
  const dataRetryPolicy = isSupportRetryPolicy(data?.retryPolicy)
    ? data.retryPolicy
    : undefined;
  const retryPolicy =
    reasonCode === "update-required"
      ? "never"
      : (dataRetryPolicy ??
        (writeOutcome === "not-written" ? "once" : "never"));
  const canRetry =
    kind === "mutation" &&
    retryCount === 0 &&
    writeOutcome === "not-written" &&
    retryPolicy === "once";
  const staysUntilDismissed =
    kind === "mutation" && writeOutcome === "not-written";

  return {
    canRetry,
    duration: staysUntilDismissed ? Number.POSITIVE_INFINITY : 6000,
    reason: failureMessage(error, reasonCode, kind),
    reasonCode,
    retryBound: supportRetryBound(canRetry),
    retryPolicy,
    supportReference,
    writeOutcome,
    writeOutcomeLabel: supportWriteOutcomeLabel(writeOutcome),
  };
}
