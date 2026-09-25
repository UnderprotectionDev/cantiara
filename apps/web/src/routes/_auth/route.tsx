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
import { useCallback, useEffect, useRef } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  ClientShellOfflineError,
  defaultClientShell,
} from "@/features/web-macos-client/store/client-shell";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { authClient } from "@/lib/auth-client";

class SessionConnectionError extends Error {
  constructor(cause: unknown) {
    super("The session service is unavailable.", { cause });
    this.name = "SessionConnectionError";
  }
}

function isTemporarySessionError(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false;
  }
  const status = Number(error.status);
  return Number.isFinite(status) && (status === 0 || status >= 500);
}

function sessionSupportReference(error: unknown) {
  const cause = error instanceof SessionConnectionError ? error.cause : error;
  if (typeof cause !== "object" || cause === null) {
    return null;
  }

  const causeRecord = cause as Record<string, unknown>;
  const data =
    typeof causeRecord.data === "object" && causeRecord.data !== null
      ? (causeRecord.data as Record<string, unknown>)
      : null;
  const nestedError =
    typeof causeRecord.error === "object" && causeRecord.error !== null
      ? (causeRecord.error as Record<string, unknown>)
      : null;
  const nestedData =
    nestedError &&
    typeof nestedError.data === "object" &&
    nestedError.data !== null
      ? (nestedError.data as Record<string, unknown>)
      : null;
  const reference =
    causeRecord.supportReference ??
    data?.supportReference ??
    nestedError?.supportReference ??
    nestedData?.supportReference;

  return isSupportReference(reference) ? reference : null;
}

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteError,
  beforeLoad: async () => {
    defaultClientShell.assertOnline();
    const session = await defaultClientShell
      .runOnlineOnly(() => authClient.getSession())
      .catch((error: unknown) => {
        if (isTemporarySessionError(error)) {
          throw new SessionConnectionError(error);
        }
        throw error;
      });
    if (session.error) {
      if (isTemporarySessionError(session.error)) {
        throw new SessionConnectionError(session.error);
      }
      throw session.error;
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
  const sessionConnectionFailed =
    error instanceof SessionConnectionError ||
    error instanceof ClientShellOfflineError;
  const wasOffline = useRef(connection === "offline");
  const retrySession = useCallback(() => {
    router.invalidate().catch(() => undefined);
  }, [router]);

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

  if (connection === "offline" || sessionConnectionFailed) {
    if (error instanceof SessionConnectionError && connection !== "offline") {
      return <SessionUnavailable error={error} onRetry={retrySession} />;
    }
    return (
      <ClientShellContent
        forceOffline={sessionConnectionFailed}
        onRetry={retrySession}
      >
        <ErrorComponent error={error} />
      </ClientShellContent>
    );
  }

  return <ErrorComponent error={error} />;
}

function SessionUnavailable({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const supportReference = sessionSupportReference(error);

  return (
    <main className="flex h-full min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-5 py-10 sm:px-8">
      <section
        aria-live="polite"
        className="w-full max-w-2xl rounded-lg border border-border/70 bg-card p-5 shadow-sm"
        role="status"
      >
        <h1 className="font-semibold text-2xl tracking-tight">
          Session unavailable
        </h1>
        <p className="mt-3 text-muted-foreground text-sm/relaxed">
          Cantiara could not verify your session. Retry when the service is
          available.
        </p>
        <p className="mt-3 text-muted-foreground text-sm">
          {supportReference ? (
            <>
              <span>Support reference</span> <code>{supportReference}</code>
            </>
          ) : (
            "Support reference unavailable."
          )}
        </p>
        <Button
          className="mt-5"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </section>
    </main>
  );
}
