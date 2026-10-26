import {
  isSupportReference,
  isSupportRetryPolicy,
  isSupportWriteOutcome,
  type SupportRetryPolicy,
  type SupportWriteOutcome,
} from "@cantiara/api/support-reference";
import { redirect } from "@tanstack/react-router";
import { isOfflineTransportFailure } from "@/features/web-macos-client/lib/support-reference";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { authClient } from "@/lib/auth-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sessionStatus(error: unknown) {
  if (!(isRecord(error) && "status" in error)) {
    return Number.NaN;
  }
  return Number(error.status);
}

function isTemporarySessionError(error: unknown) {
  const status = sessionStatus(error);
  return (
    error instanceof TypeError ||
    isOfflineTransportFailure(error) ||
    status === 0 ||
    (Number.isFinite(status) && status >= 500)
  );
}

function sessionFailureData(error: unknown): Record<string, unknown> {
  if (!isRecord(error)) {
    return {};
  }
  const {
    data: rawData,
    error: rawNestedError,
    retryPolicy: rootRetryPolicy,
    supportReference: rootSupportReference,
    writeOutcome: rootWriteOutcome,
  } = error;
  const nestedError = isRecord(rawNestedError) ? rawNestedError : {};
  const {
    data: nestedData,
    retryPolicy: nestedRetryPolicy,
    supportReference: nestedSupportReference,
    writeOutcome: nestedWriteOutcome,
  } = nestedError;
  const data = [rawData, nestedData].find(isRecord) ?? {};
  return {
    ...data,
    supportReference:
      data.supportReference ?? rootSupportReference ?? nestedSupportReference,
    retryPolicy: data.retryPolicy ?? rootRetryPolicy ?? nestedRetryPolicy,
    writeOutcome: data.writeOutcome ?? rootWriteOutcome ?? nestedWriteOutcome,
  };
}

export class SessionCheckError extends Error {
  readonly networkFailure: boolean;
  readonly supportReference?: string;
  readonly retryPolicy: SupportRetryPolicy;
  readonly writeOutcome: SupportWriteOutcome;

  constructor(error: unknown, options: ErrorOptions = {}) {
    super("Session check failed", {
      ...options,
      cause: options.cause ?? error,
    });
    this.name = "SessionCheckError";
    const networkFailure =
      error instanceof TypeError ||
      isOfflineTransportFailure(error) ||
      sessionStatus(error) === 0;
    this.networkFailure = networkFailure;
    const data = sessionFailureData(error);
    if (!networkFailure && isSupportReference(data.supportReference)) {
      this.supportReference = data.supportReference;
    }
    if (networkFailure) {
      this.retryPolicy = "once";
      this.writeOutcome = "not-written";
    } else {
      this.retryPolicy = isSupportRetryPolicy(data.retryPolicy)
        ? data.retryPolicy
        : "never";
      this.writeOutcome = isSupportWriteOutcome(data.writeOutcome)
        ? data.writeOutcome
        : "unknown";
    }
  }
}

let sessionCheckRetryConsumed = false;

export function isSessionCheckRetryConsumed() {
  return sessionCheckRetryConsumed;
}

export function consumeSessionCheckRetry() {
  sessionCheckRetryConsumed = true;
}

export async function requireSession() {
  defaultClientShell.assertOnline();
  let session: Awaited<ReturnType<typeof authClient.getSession>>;
  try {
    session = await defaultClientShell.runOnlineOnly(() =>
      authClient.getSession(),
    );
  } catch (error) {
    if (isTemporarySessionError(error)) {
      throw new SessionCheckError(error, { cause: error });
    }
    throw error;
  }
  if (session.error) {
    throw new SessionCheckError(session.error);
  }
  sessionCheckRetryConsumed = false;
  if (!session.data) {
    throw redirect({
      to: "/login",
    });
  }
  return { session };
}
