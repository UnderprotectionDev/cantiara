import { createFileRoute } from "@tanstack/react-router";

import CompletionEffectsView from "@/features/completion-effects/ui/views/completion-effects-view";

export const Route = createFileRoute("/_auth/account/completion-effects")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  return <CompletionEffectsView accountId={session.data?.user.id ?? ""} />;
}
