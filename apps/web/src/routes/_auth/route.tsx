import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import {
	SESSIONS_PATH,
	postSignInPath,
} from "@/features/account-access/forms/post-sign-in-path";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      const next = postSignInPath(location.pathname);
      throw redirect({
        search: next === SESSIONS_PATH ? { redirect: SESSIONS_PATH } : {},
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  return <Outlet />;
}
