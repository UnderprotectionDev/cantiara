import { type Document, documentSchema } from "@cantiara/api/documents";
import type { document } from "@cantiara/db/schema/document";

export function toDocument(row: typeof document.$inferSelect): Document {
  return documentSchema.parse({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    type: row.type,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    folder: row.folder,
    parentDocumentId: row.parentDocumentId,
    inlineTags: row.inlineTags,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.originDocumentId
      ? {
          origin: {
            documentId: row.originDocumentId,
            revision: row.originRevision ?? 1,
            ...(row.originConflictDraftId
              ? { conflictDraftId: row.originConflictDraftId }
              : {}),
          },
        }
      : {}),
  });
}
