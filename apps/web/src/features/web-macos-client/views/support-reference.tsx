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
import { toast } from "sonner";

const OFFLINE_ERROR_PATTERN =
  /\b(?:failed to fetch|network request failed|networkerror|offline)\b/i;
const SCHEMA_DRIFT_ERROR_PATTERN =
  /\b(?:42p01|42703)\b|(?:relation|column)\b[\s\S]{0,160}\bdoes not exist\b|\bcurrent[_ ]schema\b/i;
const UNMATCHED_RPC_ERROR_PATTERN = /\b(?:404\s+not\s+found|not found)\b/i;

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

export interface PresentSupportReferenceFailureOptions
  extends BuildSupportReferenceFailureOptions {
  retry?: () => Promise<unknown> | unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorSignals(error: unknown) {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }
  if (!isRecord(error)) {
    return "";
  }

  const signals: string[] = [];
  for (const key of ["code", "message", "status"]) {
    const value = error[key];
    if (typeof value === "string" || typeof value === "number") {
      signals.push(String(value));
    }
  }
  return signals.join(" ");
}

function errorData(error: unknown) {
  if (!(isRecord(error) && isRecord(error.data))) {
    return;
  }
  return error.data;
}

function readReasonCode(
  error: unknown,
  data: Record<string, unknown> | undefined,
) {
  if (isSupportFailureReasonCode(data?.reasonCode)) {
    return data.reasonCode;
  }

  const signals = errorSignals(error);
  if (OFFLINE_ERROR_PATTERN.test(signals)) {
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
  return "unexpected";
}

function writeOutcomeLabel(writeOutcome: SupportWriteOutcome) {
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
    dataRetryPolicy ?? (writeOutcome === "not-written" ? "once" : "never");
  const canRetry =
    kind === "mutation" &&
    retryCount === 0 &&
    writeOutcome === "not-written" &&
    retryPolicy === "once";

  return {
    canRetry,
    duration: canRetry ? Number.POSITIVE_INFINITY : 6000,
    reason: supportFailureMessage(reasonCode),
    reasonCode,
    retryBound: canRetry ? "You can retry once." : "Do not retry.",
    retryPolicy,
    supportReference,
    writeOutcome,
    writeOutcomeLabel: writeOutcomeLabel(writeOutcome),
  };
}

export function presentSupportReferenceFailure(
  error: unknown,
  options: PresentSupportReferenceFailureOptions,
) {
  const failure = buildSupportReferenceFailure(error, options);
  toast.error(failure.reason, {
    action:
      failure.canRetry && options.retry
        ? {
            label: "Retry",
            onClick: () => {
              Promise.resolve(options.retry?.()).catch(() => undefined);
            },
          }
        : undefined,
    description: <SupportReferenceNotice failure={failure} />,
    duration: failure.duration,
  });
  return failure;
}

export function SupportReferenceNotice({
  failure,
}: {
  failure: SupportReferenceFailure;
}) {
  return (
    <div aria-live="polite" className="space-y-1 text-sm" role="alert">
      <p>{failure.reason}</p>
      <p>{failure.writeOutcomeLabel}</p>
      <p>{failure.retryBound}</p>
      <p>
        <span>Support reference</span>{" "}
        <code>
          {failure.supportReference ?? "Support reference unavailable."}
        </code>
      </p>
    </div>
  );
}
