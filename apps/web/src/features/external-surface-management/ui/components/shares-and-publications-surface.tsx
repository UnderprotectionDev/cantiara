import { useExternalSurfaces } from "../../hooks/use-external-surfaces";
import { SharesAndPublicationsView } from "../views/shares-and-publications-view";

/** The directory of the Çalışma Alanı, or of one Project when `projectId` is set. */
export default function SharesAndPublicationsSurface({
  projectId,
}: {
  projectId?: string;
}) {
  const directory = useExternalSurfaces(projectId);
  return (
    <SharesAndPublicationsView
      error={directory.isError}
      loading={directory.isPending}
      rows={directory.data?.rows ?? []}
      scopeLabel={
        projectId
          ? "Every share and publication of this Project."
          : "Every share and publication of your Workspace."
      }
    />
  );
}
