import { createFileRoute } from "@tanstack/react-router";

import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";
import { smartCollectionWorkPrefillFromSearch } from "@/features/smart-collections/lib/smart-collection-work-prefill";

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  validateSearch: (search) => {
    const configurationReturn =
      typeof search.configurationReturn === "string" &&
      search.configurationReturn.length > 0
        ? search.configurationReturn
        : undefined;

    return {
      ...smartCollectionWorkPrefillFromSearch(search),
      ...(configurationReturn ? { configurationReturn } : {}),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { session } = Route.useRouteContext();

  return (
    <ProjectShellView accountId={session.data?.user.id} projectId={projectId} />
  );
}
