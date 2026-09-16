import { createFileRoute } from "@tanstack/react-router";

import PreferencesView from "@/features/account-preferences/views/preferences-view";

export const Route = createFileRoute("/_auth/account/preferences")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  return <PreferencesView accountId={session.data?.user.id ?? ""} />;
}
