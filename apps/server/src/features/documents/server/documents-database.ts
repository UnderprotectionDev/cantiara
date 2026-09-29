import type {
  CreateDocumentInput,
  Document,
  DocumentMutationContracts,
  DocumentMutationValue,
  DocumentsAccess,
  DocumentVersionSummary,
} from "@cantiara/api/documents";
import {
  createDocumentInputSchema,
  DocumentUnavailableError,
  documentSchema,
  documentVersionSummarySchema,
  updateDocumentInputSchema,
} from "@cantiara/api/documents";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

function toDocument(row: typeof document.$inferSelect): Document {
  return documentSchema.parse({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    type: row.type,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toDocumentVersionSummary(value: Document): DocumentVersionSummary {
  return documentVersionSummarySchema.parse({
    id: value.id,
    revision: value.revision,
    title: value.title,
    type: value.type,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

function documentVersionSummaryProjection(
  value:
    | typeof mutationHistory.previousValue
    | typeof mutationHistory.nextValue,
) {
  const snapshot = sql`${value}->'document'`;
  return sql<unknown>`CASE
    WHEN ${snapshot}->>'id' IS NOT NULL THEN jsonb_build_object(
      'id', ${snapshot}->'id',
      'revision', ${snapshot}->'revision',
      'title', ${snapshot}->'title',
      'type', ${snapshot}->'type',
      'createdAt', ${snapshot}->'createdAt',
      'updatedAt', ${snapshot}->'updatedAt'
    )
  END`;
}

function toTarget(
  record: typeof document.$inferSelect,
): MutationTarget<DocumentMutationValue> {
  const value = toDocument(record);
  return {
    id: value.id,
    revision: value.revision,
    value: { document: value },
  };
}

function emptyTarget(targetId: string): MutationTarget<DocumentMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { document: null },
  };
}

async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  return record ?? null;
}

async function findOwnedDocument(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  lock: boolean,
) {
  const [ownership] = await executor
    .select({ projectId: document.projectId })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(document.id, documentId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  if (!ownership) {
    return null;
  }

  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    ownership.projectId,
    lock,
  );
  if (!ownedProject || ownedProject.archivedAt !== null) {
    return null;
  }

  const query = executor
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.projectId, ownership.projectId),
      ),
    )
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  return record ?? null;
}

function createDocumentTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<DocumentMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      const payload = createDocumentInputSchema.safeParse(context?.payload);
      if (!payload.success) {
        return null;
      }
      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        payload.data.projectId,
        lock,
      );
      if (!ownedProject || ownedProject.archivedAt !== null) {
        return null;
      }
      return emptyTarget(targetId);
    },

    async update(executor, input) {
      const nextDocument = input.nextValue.document;
      if (!nextDocument || input.expectedRevision !== 0) {
        return null;
      }
      const payload: CreateDocumentInput = {
        body: nextDocument.body,
        projectId: nextDocument.projectId,
        title: nextDocument.title,
        type: nextDocument.type,
      };
      if (!createDocumentInputSchema.safeParse(payload).success) {
        return null;
      }
      const [created] = await executor
        .insert(document)
        .values({
          body: nextDocument.body,
          createdAt: input.committedAt,
          id: nextDocument.id,
          projectId: nextDocument.projectId,
          revision: 1,
          title: nextDocument.title,
          type: nextDocument.type,
          updatedAt: input.committedAt,
        })
        .returning();
      return created
        ? {
            id: input.targetId,
            revision: created.revision,
            value: { document: toDocument(created) },
          }
        : null;
    },
  };
}

function updateDocumentTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<DocumentMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      const payload = updateDocumentInputSchema.safeParse(context?.payload);
      if (!(payload.success && payload.data.documentId === targetId)) {
        return null;
      }
      const record = await findOwnedDocument(
        executor,
        accountId,
        targetId,
        lock,
      );
      return record ? toTarget(record) : null;
    },

    async update(executor, input) {
      const nextDocument = input.nextValue.document;
      if (!nextDocument || nextDocument.id !== input.targetId) {
        return null;
      }
      const [updated] = await executor
        .update(document)
        .set({
          body: nextDocument.body,
          revision: input.expectedRevision + 1,
          title: nextDocument.title,
          type: nextDocument.type,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(document.id, input.targetId),
            eq(document.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated ? toTarget(updated) : null;
    },
  };
}

export function createDatabaseDocuments(database: Database): DocumentsAccess {
  async function get(accountId: string, documentId: string) {
    const [row] = await database
      .select({ document })
      .from(document)
      .innerJoin(project, eq(document.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(document.id, documentId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    return row ? toDocument(row.document) : null;
  }

  return {
    get,
    async getVersion(accountId, documentId, revision) {
      const current = await get(accountId, documentId);
      if (!current) {
        return null;
      }
      if (current.revision === revision) {
        return current;
      }
      if (revision < 1 || revision > current.revision) {
        return null;
      }

      const historyRevision = revision === 1 ? 2 : revision;
      const snapshot =
        revision === 1
          ? sql<unknown>`${mutationHistory.previousValue}->'document'`
          : sql<unknown>`${mutationHistory.nextValue}->'document'`;
      const [entry] = await database
        .select({ snapshot })
        .from(mutationHistory)
        .where(
          and(
            eq(mutationHistory.targetId, documentId),
            eq(mutationHistory.revision, historyRevision),
          ),
        )
        .limit(1);
      const parsed = documentSchema.safeParse(entry?.snapshot);
      return parsed.success &&
        parsed.data.id === documentId &&
        parsed.data.revision === revision
        ? parsed.data
        : null;
    },
    async versions(accountId, documentId) {
      const current = await get(accountId, documentId);
      if (!current) {
        return null;
      }
      const history = await database
        .select({
          previousVersion: documentVersionSummaryProjection(
            mutationHistory.previousValue,
          ),
          nextVersion: documentVersionSummaryProjection(
            mutationHistory.nextValue,
          ),
        })
        .from(mutationHistory)
        .where(eq(mutationHistory.targetId, documentId))
        .orderBy(desc(mutationHistory.revision));
      const versions = new Map<number, DocumentVersionSummary>([
        [current.revision, toDocumentVersionSummary(current)],
      ]);
      for (const entry of history) {
        for (const value of [entry.nextVersion, entry.previousVersion]) {
          const parsed = documentVersionSummarySchema.safeParse(value);
          if (parsed.success && parsed.data.id === documentId) {
            versions.set(parsed.data.revision, parsed.data);
          }
        }
      }
      return [...versions.values()].sort((a, b) => b.revision - a.revision);
    },
    async list(accountId, projectId) {
      const ownedProject = await findOwnedProject(
        database,
        accountId,
        projectId,
        false,
      );
      if (!ownedProject) {
        throw new DocumentUnavailableError();
      }
      const rows = await database
        .select({ document })
        .from(document)
        .innerJoin(project, eq(document.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(document.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .orderBy(desc(document.updatedAt));
      return rows.map(({ document: row }) => toDocument(row));
    },
  };
}

export function createDatabaseDocumentMutationContracts(
  database: Database,
): DocumentMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract<DocumentMutationValue>(database, {
        target: createDocumentTarget(accountId),
      }),
    update: (accountId) =>
      createDatabaseMutationContract<DocumentMutationValue>(database, {
        target: updateDocumentTarget(accountId),
      }),
  };
}
