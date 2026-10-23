import { createFileRoute } from "@tanstack/react-router";

import SchemaArtifactsView from "@/features/schema-artifacts/ui/views/schema-artifacts-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

export const Route = createFileRoute(
  "/_auth/projects/$projectId/schema-artifacts",
)({
  validateSearch: (search) => ({
    diagramId:
      typeof search.diagramId === "string" && search.diagramId.length > 0
        ? search.diagramId
        : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { diagramId } = Route.useSearch();
  return (
    <ClientShellContent>
      <SchemaArtifactsView
        projectId={projectId}
        selectedDiagramId={diagramId}
      />
    </ClientShellContent>
  );
}
