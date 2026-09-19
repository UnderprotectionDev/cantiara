import { createFileRoute } from "@tanstack/react-router";

import ProjectShellView from "@/features/project-shell/ui/views/project-shell-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/projects/$projectId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { session } = Route.useRouteContext();

  return (
    <ClientShellContent>
      <ProjectShellView
        accountId={session.data?.user.id}
        projectId={projectId}
      />
    </ClientShellContent>
  );
}
