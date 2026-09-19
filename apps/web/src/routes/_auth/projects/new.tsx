import { createFileRoute } from "@tanstack/react-router";

import ProjectCreateView from "@/features/project-shell/ui/views/project-create-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/projects/new")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ClientShellContent>
      <ProjectCreateView />
    </ClientShellContent>
  );
}
