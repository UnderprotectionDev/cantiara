import type {
  FeedbackList,
  FeedbackRecord,
  FeedbackStore,
} from "@cantiara/api/feedback";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { feedback, feedbackAttachment } from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createFeedback,
  FeedbackAttachmentUnavailableError,
  FeedbackProjectReadOnlyError,
  FeedbackRevisionConflictError,
} from "./feedback";

/** Minimal existing-source intake; access and atomic finalization belong to the caller. */
export async function createFeedbackFromResearch(
  executor: MutationDatabaseExecutor,
  input: {
    id: string;
    projectId: string;
    title: string;
    originalMessage: string;
    channel: string | null;
    occurredAt: Date;
    committedAt: Date;
  },
) {
  await executor.insert(feedback).values({
    ...input,
    createdAt: input.committedAt,
    updatedAt: input.committedAt,
    status: "New",
    revision: 1,
  });
}

/** Owner-scoped original-message reader for existing-source intake consumers. */
export async function listFeedbackRecords(
  database: Database,
  accountId: string,
  projectId: string,
) {
  const rows = await database
    .select({ record: feedback })
    .from(feedback)
    .innerJoin(project, eq(project.id, feedback.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  return rows.map(({ record }) => ({
    ...record,
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

/** Current native record read; archived records remain accessible to their owner. */
export async function findFeedbackRecord(
  database: Database,
  accountId: string,
  projectId: string,
  id: string,
) {
  const [row] = await database
    .select({ record: feedback })
    .from(feedback)
    .innerJoin(project, eq(project.id, feedback.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(feedback.id, id),
        eq(project.id, projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  return row
    ? {
        id: row.record.id,
        title: row.record.title,
        status: row.record.status,
        originalMessage: row.record.originalMessage,
        channel: row.record.channel,
        occurredAt: row.record.occurredAt.toISOString(),
      }
    : null;
}

export type FeedbackExecutor = Pick<Database, "insert" | "select" | "update">;

export async function findOwnedProject(
  executor: FeedbackExecutor,
  accountId: string,
  projectId: string,
) {
  const [owned] = await executor
    .select({ archivedAt: project.archivedAt, id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .for("update", { of: project });
  return owned ?? null;
}

export async function toRecords(
  executor: FeedbackExecutor,
  rows: (typeof feedback.$inferSelect)[],
): Promise<FeedbackRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const attachments = await executor
    .select({
      feedbackId: feedbackAttachment.feedbackId,
      id: fileAttachment.id,
      name: fileAttachment.name,
    })
    .from(feedbackAttachment)
    .innerJoin(
      fileAttachment,
      eq(fileAttachment.id, feedbackAttachment.attachmentId),
    )
    .where(
      inArray(
        feedbackAttachment.feedbackId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(feedbackAttachment.createdAt), asc(fileAttachment.id));
  return rows.map((row) => ({
    attachments: attachments
      .filter(({ feedbackId }) => feedbackId === row.id)
      .map(({ id, name }) => ({ id, name })),
    channel: row.channel,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    link: row.url,
    occurredAt: row.occurredAt.toISOString(),
    originalMessage: row.originalMessage,
    projectId: row.projectId,
    revision: row.revision,
    status: row.status as FeedbackRecord["status"],
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function requireActiveAttachments(
  executor: FeedbackExecutor,
  projectId: string,
  attachmentIds: string[],
) {
  if (attachmentIds.length === 0) {
    return;
  }
  const active = await executor
    .select({ id: fileAttachment.id })
    .from(fileAttachment)
    .where(
      and(
        inArray(fileAttachment.id, attachmentIds),
        eq(fileAttachment.projectId, projectId),
        eq(fileAttachment.scopeType, "Project"),
        eq(fileAttachment.lifecycleStatus, "Active"),
      ),
    );
  if (active.length !== attachmentIds.length) {
    throw new FeedbackAttachmentUnavailableError();
  }
}

async function requireOne<T>(rows: Promise<T[]>, message: string) {
  const [row] = await rows;
  if (!row) {
    throw new Error(message);
  }
  return row;
}

async function insertFeedback(
  executor: FeedbackExecutor,
  projectId: string,
  input: Parameters<FeedbackStore["create"]>[1],
) {
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  await requireActiveAttachments(executor, projectId, attachmentIds);
  const now = new Date();
  const created = await requireOne(
    executor
      .insert(feedback)
      .values({
        channel: input.channel ?? null,
        createdAt: now,
        id: crypto.randomUUID(),
        occurredAt: new Date(input.occurredAt),
        originalMessage: input.originalMessage,
        projectId,
        revision: 1,
        status: "New",
        title: input.title,
        updatedAt: now,
        url: input.link ?? null,
      })
      .returning(),
    "Feedback was not created.",
  );
  if (attachmentIds.length > 0) {
    await executor.insert(feedbackAttachment).values(
      attachmentIds.map((attachmentId) => ({
        attachmentId,
        createdAt: now,
        feedbackId: created.id,
      })),
    );
  }
  return created;
}

/** Writes the Feedback row only; no Work, relation or Source table is reachable here. */
async function updateFeedbackStatus(
  executor: FeedbackExecutor,
  current: typeof feedback.$inferSelect,
  input: Parameters<FeedbackStore["setStatus"]>[1],
) {
  if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== current.revision
  ) {
    throw new FeedbackRevisionConflictError(current.id);
  }
  if (current.status === input.status) {
    return current;
  }
  return await requireOne(
    executor
      .update(feedback)
      .set({
        revision: current.revision + 1,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(feedback.id, current.id))
      .returning(),
    "Feedback status was not updated.",
  );
}

async function openProject(
  executor: FeedbackExecutor,
  accountId: string,
  projectId: string,
  writable: boolean,
) {
  const owned = await findOwnedProject(executor, accountId, projectId);
  if (owned && writable && owned.archivedAt) {
    throw new FeedbackProjectReadOnlyError(owned.id);
  }
  return owned;
}

/**
 * PostgreSQL adapter of the Feedback seam. It reads and writes only
 * `project_feedback` and its attachment references: no Work, relation or
 * Source table is touched, so a status change cannot reach planning.
 */
export function createDatabaseFeedbackStore(database: Database): FeedbackStore {
  return {
    create(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(
          executor,
          accountId,
          input.projectId,
          true,
        );
        if (!owned) {
          return null;
        }
        const created = await insertFeedback(executor, owned.id, input);
        const [record] = await toRecords(executor, [created]);
        return record ?? null;
      });
    },

    list(accountId, projectId): Promise<FeedbackList | null> {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, projectId, false);
        if (!owned) {
          return null;
        }
        const rows = await executor
          .select()
          .from(feedback)
          .where(eq(feedback.projectId, owned.id))
          .orderBy(desc(feedback.occurredAt), asc(feedback.id));
        return {
          readOnly: owned.archivedAt !== null,
          records: await toRecords(executor, rows),
        };
      });
    },

    setStatus(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(
          executor,
          accountId,
          input.projectId,
          true,
        );
        if (!owned) {
          return null;
        }
        const [current] = await executor
          .select()
          .from(feedback)
          .where(
            and(
              eq(feedback.id, input.feedbackId),
              eq(feedback.projectId, owned.id),
            ),
          )
          .for("update");
        if (!current) {
          return null;
        }
        const row = await updateFeedbackStatus(executor, current, input);
        const [record] = await toRecords(executor, [row]);
        return record ?? null;
      });
    },
  };
}

export function createDatabaseFeedback(database: Database) {
  return createFeedback(createDatabaseFeedbackStore(database));
}
