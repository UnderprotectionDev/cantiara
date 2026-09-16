import {
  createSupportReference,
  isSupportFailureReasonCode,
  isSupportReference,
  isSupportRetryPolicy,
  isSupportWriteOutcome,
  SUPPORT_REFERENCE_HEADER,
  type SupportFailureData,
  type SupportFailureReasonCode,
  type SupportRetryPolicy,
  type SupportWriteOutcome,
  supportFailureMessage,
} from "@cantiara/api/support-reference";

const SCHEMA_DRIFT_PATTERN =
  /\b(?:42p01|42703)\b|(?:relation|column)\b[\s\S]{0,160}\bdoes not exist\b|\bcurrent[_ ]schema\b/i;
const UNMATCHED_RPC_PATTERN = /\b(?:404\s+not\s+found|not found)\b/i;
const OFFLINE_PATTERN =
  /\b(?:failed to fetch|network request failed|networkerror|offline)\b/i;

export interface SupportReferenceFailure extends SupportFailureData {
  message: string;
}

interface PartialSupportFailureData {
  reasonCode?: SupportFailureReasonCode;
  retryPolicy?: SupportRetryPolicy;
  supportReference?: string;
  writeOutcome?: SupportWriteOutcome;
}

export interface CreateSupportReferenceFailureOptions {
  error?: unknown;
  reasonCode?: SupportFailureReasonCode;
  requestId?: string;
  retryPolicy?: SupportRetryPolicy;
  supportReference?: string;
  writeOutcome?: SupportWriteOutcome;
}

export interface SupportFailureLog {
  set: (context: {
    supportFailure: {
      reasonCode: SupportFailureReasonCode;
      retryPolicy: SupportRetryPolicy;
      supportReference: string;
      writeOutcome: SupportWriteOutcome;
    };
  }) => void;
  setLevel: (level: "error") => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeSignals(value: unknown) {
  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }
  if (!isRecord(value)) {
    return "";
  }

  const signals: string[] = [];
  for (const key of ["code", "message", "status"]) {
    const field = value[key];
    if (typeof field === "string" || typeof field === "number") {
      signals.push(String(field));
    }
  }
  return signals.join(" ");
}

function supportDataFrom(
  value: unknown,
): PartialSupportFailureData | undefined {
  if (!(isRecord(value) && isRecord(value.data))) {
    return;
  }

  const { data } = value;
  const supportData: PartialSupportFailureData = {};
  if (isSupportFailureReasonCode(data.reasonCode)) {
    supportData.reasonCode = data.reasonCode;
  }
  if (isSupportRetryPolicy(data.retryPolicy)) {
    supportData.retryPolicy = data.retryPolicy;
  }
  if (isSupportReference(data.supportReference)) {
    supportData.supportReference = data.supportReference;
  }
  if (isSupportWriteOutcome(data.writeOutcome)) {
    supportData.writeOutcome = data.writeOutcome;
  }

  return Object.keys(supportData).length > 0 ? supportData : undefined;
}

export function classifySupportReason(
  error: unknown,
): SupportFailureReasonCode {
  const supportData = supportDataFrom(error);
  if (supportData?.reasonCode) {
    return supportData.reasonCode;
  }

  const signals = safeSignals(error);
  if (OFFLINE_PATTERN.test(signals)) {
    return "offline";
  }
  if (SCHEMA_DRIFT_PATTERN.test(signals)) {
    return "schema-drift";
  }
  if (
    (isRecord(error) && (error.code === "NOT_FOUND" || error.status === 404)) ||
    UNMATCHED_RPC_PATTERN.test(signals)
  ) {
    return "restart-api";
  }
  return "unexpected";
}

export function createSupportReferenceFailure({
  error,
  reasonCode,
  requestId,
  retryPolicy,
  supportReference,
  writeOutcome,
}: CreateSupportReferenceFailureOptions = {}): SupportReferenceFailure {
  const inheritedSupportData = supportDataFrom(error);
  const resolvedWriteOutcome = isSupportWriteOutcome(writeOutcome)
    ? writeOutcome
    : (inheritedSupportData?.writeOutcome ?? "unknown");
  const resolvedReasonCode = isSupportFailureReasonCode(reasonCode)
    ? reasonCode
    : (inheritedSupportData?.reasonCode ?? classifySupportReason(error));
  const requestedRetryPolicy = isSupportRetryPolicy(retryPolicy)
    ? retryPolicy
    : inheritedSupportData?.retryPolicy;
  const resolvedRetryPolicy =
    resolvedWriteOutcome === "not-written"
      ? (requestedRetryPolicy ?? "once")
      : "never";

  return {
    message: supportFailureMessage(resolvedReasonCode),
    reasonCode: resolvedReasonCode,
    retryPolicy: resolvedRetryPolicy,
    supportReference: isSupportReference(supportReference)
      ? supportReference
      : (inheritedSupportData?.supportReference ??
        createSupportReference(requestId)),
    writeOutcome: resolvedWriteOutcome,
  };
}

export function createSupportFailureResponse(
  options: CreateSupportReferenceFailureOptions & {
    status?: number;
  } = {},
) {
  const failure = createSupportReferenceFailure(options);
  const status = options.status ?? 500;
  return Response.json(
    {
      code: "INTERNAL_SERVER_ERROR",
      data: {
        reasonCode: failure.reasonCode,
        retryPolicy: failure.retryPolicy,
        supportReference: failure.supportReference,
        writeOutcome: failure.writeOutcome,
      },
      defined: false,
      message: failure.message,
      status,
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        [SUPPORT_REFERENCE_HEADER]: failure.supportReference,
      },
      status,
    },
  );
}

export async function decorateSupportFailureResponse(
  response: Response,
  options: CreateSupportReferenceFailureOptions = {},
) {
  if (response.status < 400) {
    return response;
  }

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    payload = undefined;
  }

  const supportData = supportDataFrom(payload);
  return createSupportFailureResponse({
    ...options,
    error: options.error ?? payload,
    reasonCode: supportData?.reasonCode ?? options.reasonCode,
    retryPolicy: supportData?.retryPolicy ?? options.retryPolicy,
    status: response.status,
    supportReference: supportData?.supportReference ?? options.supportReference,
    writeOutcome: supportData?.writeOutcome ?? options.writeOutcome,
  });
}

export function recordSupportFailure(
  log: SupportFailureLog,
  failure: SupportReferenceFailure,
) {
  log.set({
    supportFailure: {
      reasonCode: failure.reasonCode,
      retryPolicy: failure.retryPolicy,
      supportReference: failure.supportReference,
      writeOutcome: failure.writeOutcome,
    },
  });
  log.setLevel("error");
}
