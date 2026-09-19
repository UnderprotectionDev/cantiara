import { createFileRoute } from "@tanstack/react-router";
import ProjectsView from "@/features/project-shell/ui/views/projects-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/projects/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ClientShellContent>
      <ProjectsView />
    </ClientShellContent>
  );
}
