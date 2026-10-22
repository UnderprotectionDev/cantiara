import { createFileRoute } from "@tanstack/react-router";

import { gitHubAppSetupFromSearch } from "@/features/github-integration/lib/github-app-setup-search";
import { GitHubAppSetupView } from "@/features/github-integration/ui/views/github-app-setup-view";

export const Route = createFileRoute("/_auth/github-app-setup")({
  validateSearch: (search) => gitHubAppSetupFromSearch(search),
  component: RouteComponent,
});

function RouteComponent() {
  return <GitHubAppSetupView setup={Route.useSearch()} />;
}
