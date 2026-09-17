import { createFileRoute } from "@tanstack/react-router";

import ProjectShellView from "@/features/project-shell/views/project-shell-view";
import { ClientShellContent } from "@/features/web-macos-client/views/client-shell";

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return (
    <ClientShellContent>
      <ProjectShellView projectId={projectId} />
    </ClientShellContent>
  );
}
