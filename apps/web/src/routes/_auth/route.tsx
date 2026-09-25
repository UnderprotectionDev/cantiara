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
import { useCallback, useEffect, useRef, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  isOfflineTransportFailure,
  supportRetryBound,
  supportWriteOutcomeLabel,
} from "@/features/web-macos-client/lib/support-reference";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { authClient } from "@/lib/auth-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class SessionCheckError extends Error {
  readonly supportReference?: string;
  readonly retryPolicy: SupportRetryPolicy;
  readonly writeOutcome: SupportWriteOutcome;

  constructor(error: unknown) {
    super("Session check failed");
    this.name = "SessionCheckError";
    const data = isRecord(error) && isRecord(error.data) ? error.data : {};
    if (isSupportReference(data.supportReference)) {
      this.supportReference = data.supportReference;
    }
    this.retryPolicy = isSupportRetryPolicy(data.retryPolicy)
      ? data.retryPolicy
      : "never";
    this.writeOutcome = isSupportWriteOutcome(data.writeOutcome)
      ? data.writeOutcome
      : "unknown";
  }
}

let sessionCheckRetryConsumed = false;

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteError,
  beforeLoad: async () => {
    defaultClientShell.assertOnline();
    const session = await defaultClientShell.runOnlineOnly(() =>
      authClient.getSession(),
    );
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
  const wasOffline = useRef(connection === "offline");
  const handleRetry = useCallback(async () => {
    if (isRetrying || sessionCheckRetryConsumed) {
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
  }, [isRetrying, router]);

  useEffect(() => {
    if (connection === "offline") {
      wasOffline.current = true;
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      router.invalidate().catch(() => undefined);
    }
  }, [connection, router]);

  if (connection === "offline") {
    return (
      <ClientShellContent>
        <ErrorComponent error={error} />
      </ClientShellContent>
    );
  }

  const isNetworkFailure =
    error instanceof TypeError && isOfflineTransportFailure(error);
  const isSessionCheckFailure = error instanceof SessionCheckError;
  const writeOutcome = isSessionCheckFailure
    ? error.writeOutcome
    : "not-written";
  const retryPolicy = isSessionCheckFailure ? error.retryPolicy : "once";
  const canRetry =
    !sessionCheckRetryConsumed &&
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
                disabled={isRetrying}
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
