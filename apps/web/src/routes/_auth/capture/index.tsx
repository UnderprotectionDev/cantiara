import { createFileRoute } from "@tanstack/react-router";

import CaptureInboxView from "@/features/capture-triage/ui/views/capture-inbox-view";

export const Route = createFileRoute("/_auth/capture/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  return <CaptureInboxView accountId={session.data?.user.id ?? ""} />;
}
