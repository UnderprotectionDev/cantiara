import type {
  DocumentTransferInput,
  DocumentTransferPreview,
} from "@cantiara/api/document-transfers";
import type { DocumentMutationValue } from "@cantiara/api/documents";
import {
  DocumentHierarchyError,
  DocumentUnavailableError,
  documentLiveDirectives,
  documentRecordReferences,
  documentSchema,
} from "@cantiara/api/documents";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { document, documentConflictDraft } from "@cantiara/db/schema/document";
import { externalSurface } from "@cantiara/db/schema/external-surface";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { assertDocumentSectionAcyclic } from "./document-live-section-database";
import {
  findOwnedDocument,
  findOwnedProject,
  findWorkspaceId,
} from "./document-ownership-database";
import { toDocument } from "./document-row";

type DocumentRow = typeof document.$inferSelect;

function transferReferences(rows: Array<{ body: string }>) {
  const references = rows.flatMap(({ body }) => [
    ...documentRecordReferences(body).map((reference) => ({
      recordType: reference.recordType,
      id: reference.recordId,
      title: reference.label,
      reference,
    })),
    ...documentLiveDirectives(body).map((directive) => ({
      recordType: directive.kind,
      id: directive.id,
      title: directive.sectionId ?? directive.viewId ?? directive.id,
      directive,
    })),
  ]);
  return [
    ...new Map(
      references.map((reference) => [
        `${reference.recordType}:${reference.id}:${reference.title}`,
        reference,
      ]),
    ).values(),
  ];
}

function transferDescendants(rows: DocumentRow[], sourceId: string) {
  const descendants = new Set<string>();
  const pending = [sourceId];
  while (pending.length) {
    const parentId = pending.pop();
    for (const row of rows) {
      if (row.parentDocumentId === parentId && !descendants.has(row.id)) {
        descendants.add(row.id);
        pending.push(row.id);
      }
    }
  }
  return descendants;
}

async function transferBlockReason(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: DocumentTransferInput,
  source: DocumentRow,
  rows: DocumentRow[],
  descendantIds: Set<string>,
  lock: boolean,
) {
  if (source.revision !== input.documentRevision) {
    return "A newer Document version is available. Preview again.";
  }
  if (input.action !== "move") {
    return null;
  }
  const sourceProject =
    source.projectId === null
      ? null
      : await findOwnedProject(executor, accountId, source.projectId, lock);
  if (sourceProject?.status !== "Active") {
    return "Move requires an Active Project.";
  }
  if (input.targetProjectId === source.projectId) {
    return "Move requires a different ownership scope.";
  }
  const selectedIds = new Set([
    source.id,
    ...input.children.map(({ id }) => id),
  ]);
  if (
    selectedIds.size !== input.children.length + 1 ||
    input.children.some(
      ({ id, revision }) =>
        !descendantIds.has(id) ||
        rows.find((row) => row.id === id)?.revision !== revision,
    )
  ) {
    return "The selected child Documents changed. Preview again.";
  }
  return null;
}

async function transferSnapshot(
  executor: MutationDatabaseExecutor,
  source: DocumentRow,
  input: DocumentTransferInput,
) {
  if (input.action !== "copy" || input.sourceRevision === source.revision) {
    return toDocument(source);
  }
  const [entry] = await executor
    .select({
      snapshot:
        input.sourceRevision === 1
          ? sql<unknown>`${mutationHistory.previousValue}->'document'`
          : sql<unknown>`${mutationHistory.nextValue}->'document'`,
    })
    .from(mutationHistory)
    .where(
      and(
        eq(mutationHistory.targetId, source.id),
        eq(
          mutationHistory.revision,
          input.sourceRevision === 1 ? 2 : input.sourceRevision,
        ),
      ),
    )
    .limit(1);
  const parsed = documentSchema.safeParse(entry?.snapshot);
  return parsed.success &&
    parsed.data.id === source.id &&
    parsed.data.revision === input.sourceRevision
    ? parsed.data
    : null;
}

async function prepareTransfer(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: DocumentTransferInput,
  lock = false,
) {
  const workspaceId = await findWorkspaceId(executor, accountId, lock);
  const source = await findOwnedDocument(
    executor,
    accountId,
    input.documentId,
    lock,
  );
  if (!(workspaceId && source)) {
    throw new DocumentUnavailableError();
  }
  const destination =
    input.targetProjectId === null
      ? null
      : await findOwnedProject(
          executor,
          accountId,
          input.targetProjectId,
          lock,
        );
  if (
    input.targetProjectId !== null &&
    (!destination || destination.archivedAt || destination.status !== "Active")
  ) {
    throw new DocumentUnavailableError();
  }
  const query = executor
    .select()
    .from(document)
    .where(
      source.projectId === null
        ? and(isNull(document.projectId), eq(document.workspaceId, workspaceId))
        : eq(document.projectId, source.projectId),
    )
    .orderBy(asc(document.id));
  const rows = lock ? await query.for("update") : await query;
  const descendantIds = transferDescendants(rows, source.id);
  const selectedIds = new Set([
    source.id,
    ...(input.action === "move" ? input.children.map(({ id }) => id) : []),
  ]);
  const selected = rows.filter(({ id }) => selectedIds.has(id));
  const attachmentQuery = executor
    .select()
    .from(fileAttachment)
    .where(
      and(
        eq(fileAttachment.workspaceId, workspaceId),
        inArray(fileAttachment.ownerDocumentId, [...selectedIds]),
        source.projectId === null
          ? and(
              eq(fileAttachment.scopeType, "Personal Wiki"),
              eq(fileAttachment.personalWikiId, accountId),
            )
          : and(
              eq(fileAttachment.scopeType, "Project"),
              eq(fileAttachment.projectId, source.projectId),
            ),
      ),
    )
    .orderBy(asc(fileAttachment.id));
  const attachments = lock
    ? await attachmentQuery.for("update")
    : await attachmentQuery;
  const surfaceQuery = executor
    .select({ id: externalSurface.id })
    .from(externalSurface)
    .where(
      and(
        eq(externalSurface.workspaceId, workspaceId),
        inArray(externalSurface.documentId, [...selectedIds]),
        isNull(externalSurface.cancelledAt),
      ),
    )
    .orderBy(asc(externalSurface.id));
  const surfaces = lock ? await surfaceQuery.for("update") : await surfaceQuery;
  const detached =
    input.action === "move"
      ? rows.filter(
          ({ id, parentDocumentId }) =>
            !selectedIds.has(id) &&
            parentDocumentId !== null &&
            selectedIds.has(parentDocumentId),
        )
      : [];
  const savedSnapshot = await transferSnapshot(executor, source, input);
  const snapshot = savedSnapshot ?? toDocument(source);
  let reason = "The selected Document version is unavailable." as string | null;
  if (savedSnapshot) {
    reason = await transferBlockReason(
      executor,
      accountId,
      input,
      source,
      rows,
      descendantIds,
      lock,
    );
  }
  if (input.action === "move" && surfaces.length > 0) {
    reason = "Cancel External Surface before Move.";
  }
  const summary = (row: typeof document.$inferSelect) => ({
    id: row.id,
    title: row.title,
    revision: row.revision,
  });
  const preview: DocumentTransferPreview = {
    fingerprint: await fingerprintMutationPayload({
      input,
      attachments: attachments.map(({ createdAt, updatedAt, ...fields }) => ({
        ...fields,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      })),
      surfaces,
      rows: rows.map(({ id, revision, parentDocumentId }) => ({
        id,
        revision,
        parentDocumentId,
      })),
    }),
    allowed: reason === null,
    reason,
    targetProjectId: input.targetProjectId,
    attachments: attachments.map(({ id, name, ownerDocumentId, revision }) => ({
      id,
      name,
      ownerDocumentId,
      revision,
    })),
    documents:
      input.action === "copy"
        ? [
            {
              id: snapshot.id,
              title: snapshot.title,
              revision: snapshot.revision,
            },
          ]
        : selected.map(summary),
    descendants: rows.filter(({ id }) => descendantIds.has(id)).map(summary),
    detachedChildren: detached.map(summary),
    references: transferReferences(
      input.action === "copy" ? [snapshot] : selected,
    ),
  };
  return {
    preview,
    source,
    snapshot,
    selected,
    detached,
    workspaceId,
    attachments,
  };
}

async function movePreparedDocuments(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: DocumentTransferInput,
  prepared: Awaited<ReturnType<typeof prepareTransfer>>,
  mutation: {
    committedAt: Date;
    idempotencyKey: { key: string };
    payloadFingerprint: string;
  },
) {
  const affected = [...prepared.selected, ...prepared.detached];
  await executor
    .update(document)
    .set({ parentDocumentId: null })
    .where(
      inArray(
        document.id,
        affected.map(({ id }) => id),
      ),
    );
  const selectedIds = new Set(prepared.selected.map(({ id }) => id));
  if (prepared.attachments.length > 0) {
    await executor
      .update(fileAttachment)
      .set({
        scopeType: input.targetProjectId === null ? "Personal Wiki" : "Project",
        projectId: input.targetProjectId,
        personalWikiId: input.targetProjectId === null ? accountId : null,
        revision: sql`${fileAttachment.revision} + 1`,
        updatedAt: mutation.committedAt,
      })
      .where(
        inArray(
          fileAttachment.id,
          prepared.attachments.map(({ id }) => id),
        ),
      );
  }
  await executor
    .update(document)
    .set({
      projectId: input.targetProjectId,
      workspaceId: input.targetProjectId === null ? prepared.workspaceId : null,
    })
    .where(inArray(document.id, [...selectedIds]));
  await executor
    .update(documentConflictDraft)
    .set({
      projectId: input.targetProjectId,
      workspaceId: input.targetProjectId === null ? prepared.workspaceId : null,
    })
    .where(inArray(documentConflictDraft.documentId, [...selectedIds]));
  const updatedDocuments = await Promise.all(
    affected.map(async (row) => {
      const moved = selectedIds.has(row.id);
      const [updated] = await executor
        .update(document)
        .set({
          parentDocumentId:
            moved &&
            row.parentDocumentId &&
            selectedIds.has(row.parentDocumentId)
              ? row.parentDocumentId
              : null,
          folder: moved ? null : row.folder,
          revision: row.revision + 1,
          updatedAt: mutation.committedAt,
        })
        .where(eq(document.id, row.id))
        .returning();
      if (!updated) {
        throw new DocumentUnavailableError();
      }
      if (row.id === input.documentId) {
        return toDocument(updated);
      }
      await executor.insert(mutationHistory).values({
        id: crypto.randomUUID(),
        targetId: row.id,
        revision: updated.revision,
        actorId: accountId,
        actorType: "User",
        originKind: "human",
        clientIdempotencyKey: mutation.idempotencyKey.key,
        payloadFingerprint: mutation.payloadFingerprint,
        previousValue: { document: toDocument(row) },
        nextValue: { document: toDocument(updated) },
        occurredAt: mutation.committedAt,
      });
      return toDocument(updated);
    }),
  );
  const root = updatedDocuments.find(({ id }) => id === input.documentId);
  if (!root) {
    throw new DocumentUnavailableError();
  }
  return root;
}

export async function previewDatabaseDocumentTransfer(
  database: Database,
  accountId: string,
  input: DocumentTransferInput,
) {
  return await database.transaction(
    async (executor) =>
      (await prepareTransfer(executor, accountId, input, true)).preview,
  );
}

export function createDatabaseDocumentTransferContract(
  database: Database,
  accountId: string,
  input: DocumentTransferInput,
  previewFingerprint: string,
) {
  return createDatabaseMutationContract<DocumentMutationValue>(database, {
    target: {
      committedValue: (target) => target.value,
      async find(executor, targetId, lock) {
        await findWorkspaceId(executor, accountId, lock);
        const existing = await findOwnedDocument(
          executor,
          accountId,
          targetId,
          lock,
        );
        if (existing) {
          return {
            id: targetId,
            revision: existing.revision,
            value: { document: toDocument(existing) },
          };
        }
        if (input.action !== "copy" || targetId !== input.copyDocumentId) {
          return null;
        }
        const prepared = await prepareTransfer(
          executor,
          accountId,
          input,
          lock,
        );
        return {
          id: targetId,
          revision: 0,
          value: { document: null, sourceDocument: prepared.snapshot },
        };
      },
      async update(executor, mutation) {
        const prepared = await prepareTransfer(
          executor,
          accountId,
          input,
          true,
        );
        if (
          !prepared.preview.allowed ||
          prepared.preview.fingerprint !== previewFingerprint
        ) {
          throw new DocumentHierarchyError(
            prepared.preview.reason ??
              "The transfer preview changed. Preview again.",
          );
        }
        const next = mutation.nextValue.document;
        if (!next) {
          return null;
        }
        if (input.action === "copy") {
          await assertDocumentSectionAcyclic(
            executor,
            accountId,
            next.id,
            next.body,
          );
          const [created] = await executor
            .insert(document)
            .values({
              id: next.id,
              projectId: input.targetProjectId,
              workspaceId:
                input.targetProjectId === null ? prepared.workspaceId : null,
              title: next.title,
              body: next.body,
              type: next.type,
              inlineTags: next.inlineTags,
              originDocumentId: prepared.source.id,
              originRevision: prepared.snapshot.revision,
              revision: 1,
              createdAt: mutation.committedAt,
              updatedAt: mutation.committedAt,
            })
            .returning();
          return created
            ? {
                id: created.id,
                revision: created.revision,
                value: { document: toDocument(created) },
              }
            : null;
        }
        const root = await movePreparedDocuments(
          executor,
          accountId,
          input,
          prepared,
          mutation,
        );
        return {
          id: root.id,
          revision: root.revision,
          value: { document: root },
        };
      },
    },
  });
}
