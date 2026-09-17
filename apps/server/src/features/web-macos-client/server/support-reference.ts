import {
  DESKTOP_API_UPDATE_REQUIRED_CODE,
  DESKTOP_API_UPDATE_REQUIRED_HEADER,
} from "@cantiara/api/desktop-api-window";
import { MUTATION_UI_LABELS } from "@cantiara/api/mutation-and-undo";
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
const UPDATE_REQUIRED_PATTERN = /\b(?:update_required|update required)\b/i;
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

interface PreservedMutationResponse {
  code: "CONFLICT" | "PRECONDITION_FAILED";
  data: Record<string, unknown>;
  defined: boolean;
  message: string;
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

interface StandardRpcResponsePayload {
  json: Record<string, unknown>;
  meta?: unknown;
}

function isStandardRpcResponsePayload(
  value: unknown,
): value is StandardRpcResponsePayload {
  return (
    isRecord(value) &&
    isRecord(value.json) &&
    Object.keys(value).every((key) => key === "json" || key === "meta")
  );
}

export function unwrapStandardRpcResponsePayload(value: unknown) {
  return isStandardRpcResponsePayload(value) ? value.json : value;
}

export async function wrapSupportFailureResponseForRpc(
  response: Response,
  { meta }: { meta?: unknown } = {},
) {
  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  if (!isRecord(payload) || isStandardRpcResponsePayload(payload)) {
    return response;
  }

  const headers = new Headers(response.headers);
  return new Response(
    JSON.stringify({
      json: payload,
      ...(meta === undefined ? {} : { meta }),
    }),
    {
      headers,
      status: response.status,
    },
  );
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

function preservedMutationResponseFrom(
  value: unknown,
): PreservedMutationResponse | undefined {
  if (!(isRecord(value) && isRecord(value.data))) {
    return;
  }

  const { data } = value;
  if (value.code === "CONFLICT" && data.code === "CONFLICT") {
    if (typeof data.targetId !== "string" || data.targetId.length === 0) {
      return;
    }

    return {
      code: "CONFLICT",
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        targetId: data.targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    };
  }

  if (
    value.code !== "PRECONDITION_FAILED" ||
    data.code !== "STALE_BASE_REVISION" ||
    typeof data.currentRevision !== "number" ||
    !Number.isSafeInteger(data.currentRevision) ||
    data.currentRevision < 0 ||
    !isRecord(data.currentValue) ||
    typeof data.targetId !== "string" ||
    data.targetId.length === 0
  ) {
    return;
  }

  return {
    code: "PRECONDITION_FAILED",
    data: {
      code: "STALE_BASE_REVISION",
      currentRevision: data.currentRevision,
      currentValue: data.currentValue,
      label: MUTATION_UI_LABELS.currentValue,
      targetId: data.targetId,
    },
    defined: true,
    message: MUTATION_UI_LABELS.currentValue,
  };
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
  if (
    (isRecord(error) &&
      (error.code === "UPDATE_REQUIRED" || error.status === 426)) ||
    UPDATE_REQUIRED_PATTERN.test(signals)
  ) {
    return "update-required";
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
  const preservedMutationResponse = preservedMutationResponseFrom(error);
  const inheritedSupportData = supportDataFrom(error);
  let resolvedWriteOutcome: SupportWriteOutcome = "unknown";
  if (preservedMutationResponse) {
    resolvedWriteOutcome = "not-written";
  } else if (isSupportWriteOutcome(writeOutcome)) {
    resolvedWriteOutcome = writeOutcome;
  } else if (inheritedSupportData?.writeOutcome) {
    resolvedWriteOutcome = inheritedSupportData.writeOutcome;
  }
  const resolvedReasonCode = isSupportFailureReasonCode(reasonCode)
    ? reasonCode
    : (inheritedSupportData?.reasonCode ?? classifySupportReason(error));
  let requestedRetryPolicy: SupportRetryPolicy | undefined;
  if (preservedMutationResponse) {
    requestedRetryPolicy = "never";
  } else if (isSupportRetryPolicy(retryPolicy)) {
    requestedRetryPolicy = retryPolicy;
  } else {
    requestedRetryPolicy = inheritedSupportData?.retryPolicy;
  }
  let resolvedRetryPolicy: SupportRetryPolicy = "never";
  if (
    resolvedReasonCode !== "update-required" &&
    resolvedWriteOutcome === "not-written"
  ) {
    resolvedRetryPolicy = requestedRetryPolicy ?? "once";
  }

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
    code?: string;
    data?: Record<string, unknown>;
    defined?: boolean;
    message?: string;
    status?: number;
  } = {},
) {
  const failure = createSupportReferenceFailure(options);
  const preservedMutationResponse = preservedMutationResponseFrom(
    options.error,
  );
  const status = options.status ?? 500;
  return Response.json(
    {
      code:
        options.code ??
        preservedMutationResponse?.code ??
        "INTERNAL_SERVER_ERROR",
      data: {
        ...(options.data ?? preservedMutationResponse?.data),
        reasonCode: failure.reasonCode,
        retryPolicy: failure.retryPolicy,
        supportReference: failure.supportReference,
        writeOutcome: failure.writeOutcome,
      },
      defined: options.defined ?? preservedMutationResponse?.defined ?? false,
      message:
        options.message ??
        preservedMutationResponse?.message ??
        failure.message,
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

export function createDesktopApiUpdateRequiredResponse(requestId?: string) {
  const failure = createSupportReferenceFailure({
    reasonCode: "update-required",
    requestId,
    writeOutcome: "not-written",
  });
  const response = createSupportFailureResponse({
    code: DESKTOP_API_UPDATE_REQUIRED_CODE,
    error: failure,
    reasonCode: failure.reasonCode,
    requestId,
    retryPolicy: failure.retryPolicy,
    supportReference: failure.supportReference,
    status: 426,
    writeOutcome: failure.writeOutcome,
  });
  response.headers.set(DESKTOP_API_UPDATE_REQUIRED_HEADER, "true");
  return response;
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

  const rpcPayload = isStandardRpcResponsePayload(payload) ? payload : null;
  const responsePayload = unwrapStandardRpcResponsePayload(payload);
  const supportData = supportDataFrom(responsePayload);
  const preservedMutationResponse =
    preservedMutationResponseFrom(responsePayload);
  const failureResponse = createSupportFailureResponse({
    ...options,
    ...preservedMutationResponse,
    error: options.error ?? responsePayload,
    reasonCode: supportData?.reasonCode ?? options.reasonCode,
    retryPolicy: supportData?.retryPolicy ?? options.retryPolicy,
    status: response.status,
    supportReference: supportData?.supportReference ?? options.supportReference,
    writeOutcome: supportData?.writeOutcome ?? options.writeOutcome,
  });

  if (!rpcPayload) {
    return failureResponse;
  }

  return wrapSupportFailureResponseForRpc(failureResponse, {
    meta: rpcPayload.meta,
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
