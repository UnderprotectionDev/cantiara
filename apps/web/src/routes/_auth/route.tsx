import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { ClientShellStatus } from "@/features/web-macos-client/views/client-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  return (
    <>
      <ClientShellStatus />
      <Outlet />
    </>
  );
}
