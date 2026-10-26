import { Button } from "@cantiara/ui/components/button";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorComponent, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  isOfflineTransportFailure,
  supportRetryBound,
  supportWriteOutcomeLabel,
} from "@/features/web-macos-client/lib/support-reference";
import { ClientShellOfflineError } from "@/features/web-macos-client/store/client-shell";
import {
  consumeSessionCheckRetry,
  isSessionCheckRetryConsumed,
  SessionCheckError,
} from "../../lib/auth-session-check";

export default function AuthRouteErrorView({ error }: ErrorComponentProps) {
  const router = useRouter();
  const connection = useClientShellConnection();
  const [isRetrying, setIsRetrying] = useState(false);
  const handleRetry = useCallback(async () => {
    if (
      isRetrying ||
      isSessionCheckRetryConsumed() ||
      connection === "offline"
    ) {
      return;
    }

    consumeSessionCheckRetry();
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
    !(isSessionCheckRetryConsumed() || isRetrying) &&
    retryPolicy === "once" &&
    writeOutcome === "not-written" &&
    (isNetworkFailure || isSessionCheckFailure);

  if (isNetworkFailure || isSessionCheckFailure) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-5 py-10 sm:px-8">
        <SessionCheckFailureNotice
          canRetry={canRetry}
          connection={connection}
          error={error}
          handleRetry={handleRetry}
          isRetrying={isRetrying}
          isSessionCheckFailure={isSessionCheckFailure}
          writeOutcome={writeOutcome}
        />
      </main>
    );
  }

  return <ErrorComponent error={error} />;
}

function SessionCheckFailureNotice({
  isRetrying,
  isSessionCheckFailure,
  error,
  writeOutcome,
  canRetry,
  connection,
  handleRetry,
}: {
  isRetrying: boolean;
  isSessionCheckFailure: boolean;
  error: ErrorComponentProps["error"];
  writeOutcome: "not-written" | "unknown" | "written";
  canRetry: boolean;
  connection: import("@/features/web-macos-client/store/client-shell").ClientConnectionState;
  handleRetry: () => Promise<void>;
}) {
  return (
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
        {error instanceof SessionCheckError &&
        isSessionCheckFailure &&
        error.supportReference ? (
          <>
            <span>Support reference</span> <code>{error.supportReference}</code>
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
  );
}
