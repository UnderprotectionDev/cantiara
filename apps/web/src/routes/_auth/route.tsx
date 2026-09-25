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
  /\b(?:failed to fetch|network request failed|networkerror)\b/i;

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteError,
  beforeLoad: async () => {
    defaultClientShell.assertOnline();
    const session = await defaultClientShell.runOnlineOnly(() =>
      authClient.getSession(),
    );
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

  if (error instanceof TypeError && FETCH_FAILURE_PATTERN.test(error.message)) {
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
            Cantiara couldn’t be reached.
          </h1>
          <p className="mt-3 max-w-prose text-base/7 text-foreground/75">
            Support reference unavailable.
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
