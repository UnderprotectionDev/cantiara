import type { FavoriteEntry } from "@cantiara/api/favorites";
import type { SourceRecordPreviewTarget } from "@/features/record-discovery/ui/components/context-record-preview";

export function favoritePreviewTarget(
  entry: FavoriteEntry,
): SourceRecordPreviewTarget | null {
  if (entry.status !== "available") {
    return null;
  }
  const label = entry.title;
  if (entry.sourceRecordType === "Document") {
    return {
      kind: "document",
      label,
      documentId: entry.sourceRecordId,
      projectId: entry.projectId,
    };
  }
  if (!entry.projectId) {
    return null;
  }
  switch (entry.sourceRecordType) {
    case "Project":
      return { kind: "project", label, projectId: entry.projectId };
    case "Work":
      return {
        kind: "work",
        label,
        projectId: entry.projectId,
        workId: entry.sourceRecordId,
      };
    case "Decision":
      return {
        kind: "project-source-record",
        label,
        projectId: entry.projectId,
        sourceId: entry.sourceRecordId,
        sourceType: "Decision",
      };
    case "Smart Collection":
      return entry.viewId
        ? {
            kind: "smart-collection",
            label,
            projectId: entry.projectId,
            collectionId: entry.sourceRecordId,
            viewId: entry.viewId,
          }
        : null;
    default:
      return null;
  }
}
