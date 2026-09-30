import {
  documentSchema,
  renameDocumentInlineTag,
  resolveDocumentInlineTags,
} from "@cantiara/api/documents";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { TagInlineRenameWriter } from "@cantiara/api/tags";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { workspaceTag } from "@cantiara/db/schema/tags";
import { asc, eq } from "drizzle-orm";

type DocumentTagExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete"
>;

export function createDatabaseDocumentTagRenameWriter(): TagInlineRenameWriter<DocumentTagExecutor> {
  return {
    async renameInlineUses(executor, input) {
      const tags = await executor
        .select({ id: workspaceTag.id, name: workspaceTag.name })
        .from(workspaceTag)
        .where(eq(workspaceTag.workspaceId, input.workspaceId));
      const previousTags = tags.map((tag) =>
        tag.id === input.tagId ? { ...tag, name: input.previousName } : tag,
      );
      const rows = await executor
        .select({ document, accountId: workspace.ownerAccountId })
        .from(document)
        .innerJoin(project, eq(project.id, document.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(eq(workspace.id, input.workspaceId))
        .orderBy(asc(document.id))
        .for("update", { of: document });
      const payloadFingerprint = await fingerprintMutationPayload({
        tagId: input.tagId,
        name: input.nextName,
      });
      await Promise.all(
        rows.map(async ({ document: record, accountId }) => {
          const inlineTags = resolveDocumentInlineTags(
            record.body,
            previousTags,
            record.inlineTags,
          );
          if (!inlineTags.some(({ tagId }) => tagId === input.tagId)) {
            return;
          }
          const renamed = renameDocumentInlineTag(
            record.body,
            inlineTags,
            input.tagId,
            input.nextName,
          );
          const previous = documentSchema.parse({
            id: record.id,
            projectId: record.projectId,
            title: record.title,
            body: record.body,
            type: record.type,
            folder: record.folder,
            parentDocumentId: record.parentDocumentId,
            revision: record.revision,
            inlineTags,
            archivedAt: record.archivedAt?.toISOString() ?? null,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          });
          const next = documentSchema.parse({
            ...previous,
            ...renamed,
            revision: record.revision + 1,
            updatedAt: input.committedAt,
          });
          await executor
            .update(document)
            .set({
              ...renamed,
              revision: next.revision,
              updatedAt: new Date(input.committedAt),
            })
            .where(eq(document.id, record.id));
          await executor.insert(mutationHistory).values({
            id: crypto.randomUUID(),
            targetId: record.id,
            revision: next.revision,
            actorId: accountId,
            actorType: "User",
            originKind: "source",
            sourceId: input.tagId,
            deliveryId: `${input.tagId}:${input.committedAt}`,
            payloadFingerprint,
            previousValue: { document: previous },
            nextValue: { document: next },
            occurredAt: new Date(input.committedAt),
          });
        }),
      );
    },
  };
}
