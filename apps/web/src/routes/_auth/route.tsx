import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  createFileRoute,
  ErrorComponent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  ClientShellContent,
  defaultClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import { authClient } from "@/lib/auth-client";

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
  const wasOffline = useRef(connection === "offline");

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

  return <ErrorComponent error={error} />;
}
