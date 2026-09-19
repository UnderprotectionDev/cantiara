import { createFileRoute } from "@tanstack/react-router";

import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { session } = Route.useRouteContext();

  return (
    <ProjectShellView accountId={session.data?.user.id} projectId={projectId} />
  );
}
