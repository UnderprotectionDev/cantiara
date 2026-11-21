// biome-ignore-all lint/performance/noJsxPropsBind: Route callbacks bind navigation to this outlet.
import { createFileRoute } from "@tanstack/react-router";

import SchemaArtifactsView from "@/features/schema-artifacts/ui/views/schema-artifacts-view";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";

function optionalId(input: unknown) {
  return typeof input === "string" && input.length > 0 && input.length <= 255
    ? input
    : undefined;
}

export const Route = createFileRoute(
  "/_auth/projects/$projectId/schema-artifacts",
)({
  validateSearch: (
    search,
  ): {
    diagramId?: string;
    versionId?: string;
    sourceId?: string;
    targetId?: string;
  } => ({
    diagramId: optionalId(search.diagramId),
    versionId: optionalId(search.versionId),
    sourceId: optionalId(search.sourceId),
    targetId: optionalId(search.targetId),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const selection = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ClientShellContent>
      <SchemaArtifactsView
        onSelect={(diagramId, field, id) => {
          navigate({
            search: (current) => ({
              ...(current.diagramId === diagramId ? current : { diagramId }),
              [field]: id,
            }),
          }).catch(() => undefined);
        }}
        projectId={projectId}
        selection={selection}
      />
    </ClientShellContent>
  );
}
