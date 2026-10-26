import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireSession } from "@/features/account-access/lib/auth-session-check";
import AuthRouteErrorView from "@/features/account-access/ui/views/auth-route-error-view";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: AuthRouteErrorView,
  beforeLoad: requireSession,
});

function AuthLayout() {
  return <Outlet />;
}
