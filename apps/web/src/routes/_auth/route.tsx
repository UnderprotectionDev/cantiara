import { isSupportReference } from "@cantiara/api/support-reference";
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
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { authClient } from "@/lib/auth-client";

const FETCH_FAILURE_PATTERN =
  /\b(?:failed to fetch|network request failed|networkerror|load failed)\b/i;

class SessionCheckError extends Error {
  readonly supportReference?: string;

  constructor(supportReference?: string) {
    super("Session check failed");
    this.name = "SessionCheckError";
    if (supportReference) {
      this.supportReference = supportReference;
    }
  }
}

function sessionSupportReference(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("data" in error) ||
    typeof error.data !== "object" ||
    error.data === null ||
    !("supportReference" in error.data) ||
    !isSupportReference(error.data.supportReference)
  ) {
    return;
  }
  return error.data.supportReference;
}

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteError,
  beforeLoad: async () => {
    defaultClientShell.assertOnline();
    const session = await defaultClientShell.runOnlineOnly(() =>
      authClient.getSession(),
    );
    if (session.error) {
      throw new SessionCheckError(sessionSupportReference(session.error));
    }
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
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      await router.invalidate();
    } catch {
      // Keep the error state available so the user can retry again.
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
    error instanceof TypeError && FETCH_FAILURE_PATTERN.test(error.message);
  const isSessionCheckFailure = error instanceof SessionCheckError;

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
          <div className="mt-6">
            <Button
              disabled={isRetrying}
              onClick={handleRetry}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return <ErrorComponent error={error} />;
}
