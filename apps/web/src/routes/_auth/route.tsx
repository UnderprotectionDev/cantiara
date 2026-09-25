import {
  isSupportReference,
  isSupportRetryPolicy,
  isSupportWriteOutcome,
  type SupportRetryPolicy,
  type SupportWriteOutcome,
} from "@cantiara/api/support-reference";
import { Button } from "@cantiara/ui/components/button";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  createFileRoute,
  ErrorComponent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  isOfflineTransportFailure,
  supportRetryBound,
  supportWriteOutcomeLabel,
} from "@/features/web-macos-client/lib/support-reference";
import {
  ClientShellOfflineError,
  defaultClientShell,
} from "@/features/web-macos-client/store/client-shell";
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

class SessionCheckError extends Error {
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

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteError,
  beforeLoad: async () => {
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
  },
});

function AuthLayout() {
  return <Outlet />;
}

function AuthRouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const connection = useClientShellConnection();
  const [isRetrying, setIsRetrying] = useState(false);
  const handleRetry = useCallback(async () => {
    if (isRetrying || sessionCheckRetryConsumed || connection === "offline") {
      return;
    }

    sessionCheckRetryConsumed = true;
    setIsRetrying(true);
    try {
      await router.invalidate();
    } catch {
      // Keep the failure visible when invalidation rejects.
    } finally {
      setIsRetrying(false);
    }
  }, [connection, isRetrying, router]);

  const isNetworkFailure =
    error instanceof ClientShellOfflineError ||
    (error instanceof TypeError && isOfflineTransportFailure(error)) ||
    (error instanceof SessionCheckError && error.networkFailure);
  const isSessionCheckFailure =
    error instanceof SessionCheckError && !error.networkFailure;
  const writeOutcome = isSessionCheckFailure
    ? error.writeOutcome
    : "not-written";
  const retryPolicy = isSessionCheckFailure ? error.retryPolicy : "once";
  const canRetry =
    !(sessionCheckRetryConsumed || isRetrying) &&
    retryPolicy === "once" &&
    writeOutcome === "not-written" &&
    (isNetworkFailure || isSessionCheckFailure);

  if (isNetworkFailure || isSessionCheckFailure) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-5 py-10 sm:px-8">
        <section
          aria-busy={isRetrying}
          aria-labelledby="auth-connection-error-title"
          aria-live="assertive"
          className="w-full max-w-2xl rounded-lg border border-destructive/35 bg-destructive/5 p-5 shadow-sm"
          role="alert"
        >
          <h1
            className="font-semibold text-3xl text-foreground tracking-tight"
            id="auth-connection-error-title"
          >
            {isSessionCheckFailure
              ? "Cantiara couldn’t check your session."
              : "Cantiara couldn’t be reached."}
          </h1>
          <p className="mt-3 max-w-prose text-base/7 text-foreground/75">
            {isSessionCheckFailure && error.supportReference ? (
              <>
                <span>Support reference</span>{" "}
                <code>{error.supportReference}</code>
              </>
            ) : (
              "Support reference unavailable."
            )}
          </p>
          <p className="mt-3 text-foreground/75 text-sm">
            {supportWriteOutcomeLabel(writeOutcome)}
          </p>
          <p className="mt-1 text-foreground/75 text-sm">
            {supportRetryBound(canRetry)}
          </p>
          <div className="mt-6">
            {canRetry ? (
              <Button
                disabled={isRetrying || connection === "offline"}
                onClick={handleRetry}
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return <ErrorComponent error={error} />;
}
