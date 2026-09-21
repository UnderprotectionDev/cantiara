import { workspaceOverviewModuleIdSchema } from "@cantiara/api/workspace-overview";
import { createFileRoute } from "@tanstack/react-router";
import ProjectsView from "@/features/project-shell/ui/views/projects-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute("/_auth/projects/")({
  validateSearch: (search) => {
    const parsed = workspaceOverviewModuleIdSchema.safeParse(
      search.overviewModule,
    );
    return parsed.success ? { overviewModule: parsed.data } : {};
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { overviewModule } = Route.useSearch();
  const { session } = Route.useRouteContext();

  return (
    <ClientShellContent>
      <ProjectsView
        accountId={session.data?.user.id}
        selectedModule={overviewModule}
      />
    </ClientShellContent>
  );
}
