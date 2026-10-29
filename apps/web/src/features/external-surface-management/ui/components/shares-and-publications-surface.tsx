// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface's state.

import { useExternalSurfaces } from "../../hooks/use-external-surfaces";
import { useRemoveExternalSurface } from "../../hooks/use-remove-external-surface";
import { SharesAndPublicationsView } from "../views/shares-and-publications-view";
import { RemoveSurfaceControl } from "./remove-surface-control";

/** The directory of the Çalışma Alanı, or of one Project when `projectId` is set. */
export default function SharesAndPublicationsSurface({
  projectId,
}: {
  projectId?: string;
}) {
  const directory = useExternalSurfaces(projectId);
  const remove = useRemoveExternalSurface();
  return (
    <SharesAndPublicationsView
      error={directory.isError}
      loading={directory.isPending}
      renderRemove={(row) => (
        <RemoveSurfaceControl
          onRemove={() => remove(row.surfaceId)}
          sourceTitle={row.source.title || row.source.kind}
        />
      )}
      rows={directory.data?.rows ?? []}
      scopeLabel={
        projectId
          ? "Every share and publication of this Project."
          : "Every share and publication of your Workspace."
      }
    />
  );
}
