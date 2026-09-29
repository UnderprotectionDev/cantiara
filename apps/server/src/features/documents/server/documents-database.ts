import type {
  CreateDocumentInput,
  Document,
  DocumentMutationContracts,
  DocumentMutationValue,
  DocumentsAccess,
} from "@cantiara/api/documents";
import {
  createDocumentInputSchema,
  DocumentUnavailableError,
  documentLiveWorkIds,
  documentSchema,
  updateDocumentInputSchema,
} from "@cantiara/api/documents";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { usageLink } from "@cantiara/db/schema/relation";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

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

async function syncDocumentLiveWorkUsageLinks(
  executor: MutationDatabaseExecutor,
  accountId: string,
  documentId: string,
  body: string,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    throw new DocumentUnavailableError();
  }
  const existing = await executor
    .select({
      id: usageLink.id,
      location: usageLink.location,
      sourceRecordId: usageLink.sourceRecordId,
    })
    .from(usageLink)
    .where(
      and(
        eq(usageLink.workspaceId, workspaceId),
        eq(usageLink.surfaceRecordType, "Document"),
        eq(usageLink.surfaceRecordId, documentId),
        eq(usageLink.kind, "Live block"),
      ),
    );
  const available = existing.filter(
    ({ location }) =>
      !!location &&
      typeof location === "object" &&
      "documentLiveWorkOrdinal" in location,
  );
  const workIds = documentLiveWorkIds(body);
  const newLinks: (typeof usageLink.$inferInsert)[] = [];
  const locationUpdates: { id: string; ordinal: number }[] = [];
  for (const [index, workId] of workIds.entries()) {
    const previousIndex = available.findIndex(
      (candidate) => candidate.sourceRecordId === workId,
    );
    if (previousIndex !== -1) {
      const [previous] = available.splice(previousIndex, 1);
      if (previous) {
        locationUpdates.push({ id: previous.id, ordinal: index });
      }
      continue;
    }
    newLinks.push({
      id: crypto.randomUUID(),
      kind: "Live block",
      location: { documentLiveWorkOrdinal: index },
      revision: 1,
      sourceRecordId: workId,
      sourceRecordType: "Work",
      surfaceRecordId: documentId,
      surfaceRecordType: "Document",
      workspaceId,
    });
  }
  if (available.length > 0) {
    await executor.delete(usageLink).where(
      inArray(
        usageLink.id,
        available.map(({ id }) => id),
      ),
    );
  }
  await Promise.all(
    locationUpdates.map(({ id, ordinal }) =>
      executor
        .update(usageLink)
        .set({ location: { documentLiveWorkOrdinal: ordinal } })
        .where(eq(usageLink.id, id)),
    ),
  );
  if (newLinks.length > 0) {
    await executor.insert(usageLink).values(newLinks);
  }
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
      if (created) {
        await syncDocumentLiveWorkUsageLinks(
          executor,
          accountId,
          created.id,
          created.body,
        );
      }
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
      if (updated) {
        await syncDocumentLiveWorkUsageLinks(
          executor,
          accountId,
          updated.id,
          updated.body,
        );
      }
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
    async getLiveWork(accountId, workId) {
      const [source] = await database
        .select({
          id: work.id,
          key: work.key,
          plannedStartDate: work.plannedStartDate,
          projectId: work.projectId,
          status: work.status,
          targetDate: work.targetDate,
          title: work.title,
          type: work.type,
        })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(work.id, workId),
            eq(workspace.ownerAccountId, accountId),
            isNull(work.trashedAt),
          ),
        )
        .limit(1);
      if (!source) {
        return null;
      }
      const priorityRows = await database
        .select({
          name: priorityMetricDefinition.name,
          rank: workPriorityMetricValue.rank,
        })
        .from(workPriorityMetricValue)
        .innerJoin(
          priorityMetricDefinition,
          eq(workPriorityMetricValue.metricId, priorityMetricDefinition.id),
        )
        .where(
          and(
            eq(workPriorityMetricValue.workId, workId),
            eq(priorityMetricDefinition.enabled, true),
            isNull(priorityMetricDefinition.trashedAt),
            isNotNull(workPriorityMetricValue.rank),
          ),
        )
        .orderBy(asc(priorityMetricDefinition.createdAt));
      return {
        ...source,
        priority: priorityRows.flatMap(({ name, rank }) =>
          rank ? [{ name, rank }] : [],
        ),
      };
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
