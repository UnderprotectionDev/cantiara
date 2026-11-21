// biome-ignore-all lint/performance/noJsxPropsBind: This route owns the saved-list editor location.
import { workspaceOverviewModuleIdSchema } from "@cantiara/api/workspace-overview";
import { createFileRoute } from "@tanstack/react-router";
import ProjectsView from "@/features/project-shell/ui/views/projects-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

import { optionalRouteId } from "@/lib/optional-route-id";

export const Route = createFileRoute("/_auth/projects/")({
  validateSearch: (search) => {
    const parsed = workspaceOverviewModuleIdSchema.safeParse(
      search.overviewModule,
    );
    const savedListId =
      typeof search.savedListId === "string" &&
      search.savedListId.trim().length > 0
        ? search.savedListId
        : undefined;
    const edit = optionalRouteId.parse(search.edit);
    return {
      ...(parsed.success ? { overviewModule: parsed.data } : {}),
      ...(savedListId ? { savedListId } : {}),
      ...(edit ? { edit } : {}),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { edit, overviewModule, savedListId } = Route.useSearch();
  const navigate = Route.useNavigate();
  function selectListEditor(id?: string) {
    navigate({ search: (current) => ({ ...current, edit: id }) }).catch(
      () => undefined,
    );
  }
  const { session } = Route.useRouteContext();

  return (
    <ClientShellContent>
      <ProjectsView
        accountId={session.data?.user.id}
        editingSavedList={edit}
        onEditSavedList={selectListEditor}
        selectedModule={overviewModule}
        selectedSavedList={savedListId}
      />
    </ClientShellContent>
  );
}
