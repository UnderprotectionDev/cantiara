import {
  buildFeedbackWorkPlan,
  emptyEvidenceQuality,
  emptyLinkEvidence,
  evidenceQualitySchema,
  type FeedbackConversion,
  type FeedbackConversionSource,
  type FeedbackLinkEvidence,
  type FeedbackList,
  type FeedbackRecord,
  type FeedbackStore,
  type FeedbackWorkOrigin,
  isSameFeedbackWorkPlan,
  mergeLinkEvidence,
  type ParsedConvertFeedbackToWorkInput,
} from "@cantiara/api/feedback";
import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  workspaceCompany,
  workspaceCompanyFeedback,
  workspaceContact,
  workspaceContactFeedback,
} from "@cantiara/db/schema/contact";
import {
  feedback,
  feedbackAttachment,
  feedbackWorkEvidence,
  feedbackWorkEvidenceHistory,
  feedbackWorkOrigin,
} from "@cantiara/db/schema/feedback";
import { fileAttachment } from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { accountActorAlias } from "../../account-access/server/github-identity-confirmation";
import { insertWorkWithKeyAllocation } from "../../evidence/server/evidence-record-creation";
import {
  MutationApplyFailedError,
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createFeedback,
  FeedbackAttachmentUnavailableError,
  FeedbackConversionStaleError,
  FeedbackIdentityUnavailableError,
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

export type FeedbackExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;

export async function findOwnedProject(
  executor: FeedbackExecutor,
  accountId: string,
  projectId: string,
) {
  const [owned] = await executor
    .select({ record: project, workspaceId: workspace.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .for("update", { of: project });
  return owned
    ? {
        archivedAt: owned.record.archivedAt,
        id: owned.record.id,
        project: owned.record,
        workspaceId: owned.workspaceId,
      }
    : null;
}

export async function toRecords(
  executor: FeedbackExecutor,
  rows: (typeof feedback.$inferSelect)[],
): Promise<FeedbackRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map(({ id }) => id);
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
    .where(inArray(feedbackAttachment.feedbackId, ids))
    .orderBy(asc(feedbackAttachment.createdAt), asc(fileAttachment.id));
  const contacts = await executor
    .select({
      displayName: workspaceContact.displayName,
      feedbackId: workspaceContactFeedback.feedbackId,
      id: workspaceContact.id,
    })
    .from(workspaceContactFeedback)
    .innerJoin(
      workspaceContact,
      eq(workspaceContact.id, workspaceContactFeedback.contactId),
    )
    .where(inArray(workspaceContactFeedback.feedbackId, ids))
    .orderBy(asc(workspaceContactFeedback.createdAt));
  const companies = await executor
    .select({
      feedbackId: workspaceCompanyFeedback.feedbackId,
      id: workspaceCompany.id,
      name: workspaceCompany.name,
    })
    .from(workspaceCompanyFeedback)
    .innerJoin(
      workspaceCompany,
      eq(workspaceCompany.id, workspaceCompanyFeedback.companyId),
    )
    .where(inArray(workspaceCompanyFeedback.feedbackId, ids));
  const origins = await executor
    .select({
      createdAt: feedbackWorkOrigin.createdAt,
      feedbackId: feedbackWorkOrigin.feedbackId,
      id: feedbackWorkOrigin.id,
      workId: work.id,
      workKey: work.key,
      workTitle: work.title,
    })
    .from(feedbackWorkOrigin)
    .innerJoin(work, eq(work.id, feedbackWorkOrigin.workId))
    .where(inArray(feedbackWorkOrigin.feedbackId, ids))
    .orderBy(asc(feedbackWorkOrigin.createdAt), asc(feedbackWorkOrigin.id));
  const originIds = origins.map(({ id }) => id);
  const evidenceRows = originIds.length
    ? await executor
        .select()
        .from(feedbackWorkEvidence)
        .where(inArray(feedbackWorkEvidence.originId, originIds))
    : [];
  const historyRows = originIds.length
    ? await executor
        .select()
        .from(feedbackWorkEvidenceHistory)
        .where(inArray(feedbackWorkEvidenceHistory.originId, originIds))
        .orderBy(asc(feedbackWorkEvidenceHistory.revision))
    : [];
  function evidenceOf(originId: string): FeedbackLinkEvidence {
    const row = evidenceRows.find((item) => item.originId === originId);
    if (!row) {
      return emptyLinkEvidence();
    }
    return {
      followUp: row.followUp as FeedbackLinkEvidence["followUp"],
      history: historyRows
        .filter((item) => item.originId === originId)
        .map((item) => ({
          actor: item.actorAlias,
          changedAt: item.changedAt.toISOString(),
          changedFields: item.changedFields as string[],
          revision: item.revision,
        })),
      quality: evidenceQualitySchema.parse({
        ...emptyEvidenceQuality(),
        ...(row.qualities as object),
      }),
      revision: row.revision,
      role: row.role as FeedbackLinkEvidence["role"],
    };
  }
  return rows.map((row) => {
    const contact = contacts.find(({ feedbackId }) => feedbackId === row.id);
    const company = companies.find(({ feedbackId }) => feedbackId === row.id);
    return {
      attachments: attachments
        .filter(({ feedbackId }) => feedbackId === row.id)
        .map(({ id, name }) => ({ id, name })),
      channel: row.channel,
      company: company ? { id: company.id, name: company.name } : null,
      contact: contact
        ? { displayName: contact.displayName, id: contact.id }
        : null,
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
      workOrigins: origins
        .filter(({ feedbackId }) => feedbackId === row.id)
        .map(
          ({
            createdAt,
            id,
            workId,
            workKey,
            workTitle,
          }): FeedbackWorkOrigin => ({
            createdAt: createdAt.toISOString(),
            evidence: evidenceOf(id),
            id,
            workId,
            workKey,
            workTitle,
          }),
        ),
    };
  });
}

/**
 * Sets or clears the optional Contact and Company of one Feedback. `undefined`
 * leaves a side alone; `null` clears it. Identity must live in the Feedback's
 * Workspace and be unarchived, and nothing is ever created here.
 */
async function applyIdentity(
  executor: FeedbackExecutor,
  workspaceId: string,
  feedbackId: string,
  identity: { companyId?: string | null; contactId?: string | null },
) {
  if (identity.contactId !== undefined) {
    await executor
      .delete(workspaceContactFeedback)
      .where(eq(workspaceContactFeedback.feedbackId, feedbackId));
    if (identity.contactId !== null) {
      const [contact] = await executor
        .select({ id: workspaceContact.id })
        .from(workspaceContact)
        .where(
          and(
            eq(workspaceContact.id, identity.contactId),
            eq(workspaceContact.workspaceId, workspaceId),
            isNull(workspaceContact.archivedAt),
          ),
        );
      if (!contact) {
        throw new FeedbackIdentityUnavailableError();
      }
      await executor.insert(workspaceContactFeedback).values({
        contactId: contact.id,
        feedbackId,
        id: crypto.randomUUID(),
        workspaceId,
      });
    }
  }
  if (identity.companyId !== undefined) {
    await executor
      .delete(workspaceCompanyFeedback)
      .where(eq(workspaceCompanyFeedback.feedbackId, feedbackId));
    if (identity.companyId !== null) {
      const [company] = await executor
        .select({ id: workspaceCompany.id })
        .from(workspaceCompany)
        .where(
          and(
            eq(workspaceCompany.id, identity.companyId),
            eq(workspaceCompany.workspaceId, workspaceId),
            isNull(workspaceCompany.archivedAt),
          ),
        );
      if (!company) {
        throw new FeedbackIdentityUnavailableError();
      }
      await executor.insert(workspaceCompanyFeedback).values({
        companyId: company.id,
        feedbackId,
        workspaceId,
      });
    }
  }
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
  owned: { id: string; workspaceId: string },
  input: Parameters<FeedbackStore["create"]>[1],
) {
  const projectId = owned.id;
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
  await applyIdentity(executor, owned.workspaceId, created.id, {
    companyId: input.companyId ?? undefined,
    contactId: input.contactId ?? undefined,
  });
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

/** Read-only source of a `Convert to Work` preview; archived Projects can still be previewed. */
async function readConversionSourceOf(
  executor: FeedbackExecutor,
  accountId: string,
  projectId: string,
  feedbackId: string,
  lock = false,
): Promise<(FeedbackConversionSource & { owned: OwnedProject }) | null> {
  const owned = lock
    ? await findOwnedProject(executor, accountId, projectId)
    : await findReadableProject(executor, accountId, projectId);
  if (!owned) {
    return null;
  }
  const query = executor
    .select()
    .from(feedback)
    .where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, owned.id)));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) {
    return null;
  }
  const [record] = await toRecords(executor, [row]);
  return record ? { owned, projectName: owned.project.name, record } : null;
}

type OwnedProject = NonNullable<Awaited<ReturnType<typeof findOwnedProject>>>;

async function findReadableProject(
  executor: FeedbackExecutor,
  accountId: string,
  projectId: string,
) {
  const [owned] = await executor
    .select({ record: project, workspaceId: workspace.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  return owned
    ? {
        archivedAt: owned.record.archivedAt,
        id: owned.record.id,
        project: owned.record,
        workspaceId: owned.workspaceId,
      }
    : null;
}

interface ConversionValue {
  nextWorkKey: string | null;
  origin: FeedbackWorkOrigin | null;
}

/**
 * Atomic `Convert to Work`: one Work, its `Origin` link and the Project key
 * allocation commit together through the Mutation Contract, so a retry with
 * the same key returns the same Work. The Feedback row is never written:
 * status, revision, message and identity stay as they were.
 */
async function convertFeedbackToWork(
  database: Database,
  accountId: string,
  input: ParsedConvertFeedbackToWorkInput,
): Promise<FeedbackConversion | null> {
  const { plan } = input;
  const adapter: MutationDatabaseTargetAdapter<ConversionValue> = {
    async find(executor, id, lock) {
      const source = await readConversionSourceOf(
        executor,
        accountId,
        input.projectId,
        input.feedbackId,
        lock,
      );
      if (!source) {
        return null;
      }
      const [row] = await executor
        .select()
        .from(feedbackWorkOrigin)
        .where(eq(feedbackWorkOrigin.id, id));
      if (row && row.feedbackId !== input.feedbackId) {
        return null;
      }
      const origin = row
        ? source.record.workOrigins.find((item) => item.id === row.id)
        : undefined;
      return {
        id,
        revision: row?.revision ?? 0,
        value: {
          nextWorkKey: `${source.owned.project.shortCode}-${
            source.owned.project.workCount + 1
          }`,
          origin: origin ?? null,
        },
      };
    },
    async update(executor, update) {
      const source = await readConversionSourceOf(
        executor,
        accountId,
        input.projectId,
        input.feedbackId,
        true,
      );
      // The exact previewed plan, re-derived under the Project and Feedback locks.
      if (source?.owned.archivedAt) {
        throw new FeedbackProjectReadOnlyError(source.owned.id);
      }
      if (
        !(
          source &&
          isSameFeedbackWorkPlan(
            plan,
            buildFeedbackWorkPlan(source, plan.work.type),
          )
        )
      ) {
        throw new MutationConflictError(input.feedbackId);
      }
      const key = await insertWorkWithKeyAllocation(
        executor,
        source.owned.project,
        {
          committedAt: update.committedAt,
          description: plan.work.description,
          idempotencyKey: update.idempotencyKey.key,
          payloadFingerprint: update.payloadFingerprint,
          title: plan.work.title,
          type: plan.work.type,
          workId: input.workId,
        },
      );
      if (key !== update.nextValue.nextWorkKey) {
        throw new MutationConflictError(input.feedbackId);
      }
      await executor.insert(feedbackWorkOrigin).values({
        actorId: accountId,
        createdAt: update.committedAt,
        feedbackId: input.feedbackId,
        id: update.targetId,
        revision: 1,
        workId: input.workId,
      });
      return {
        id: update.targetId,
        revision: update.expectedRevision + 1,
        value: update.nextValue,
      };
    },
  };
  const mutation = createDatabaseMutationContract<ConversionValue>(database, {
    target: adapter,
  });
  try {
    const receipt = await mutation.mutate(
      {
        kind: "human",
        actor: { type: "User", actorId: accountId },
        targetId: input.id,
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        payload: {
          operation: "convertFeedbackToWork",
          ...input,
        } as MutationPayload,
      },
      ({ currentValue, committedAt }) => {
        if (currentValue.origin || !currentValue.nextWorkKey) {
          throw new MutationConflictError(input.id);
        }
        return {
          nextWorkKey: currentValue.nextWorkKey,
          origin: {
            createdAt: committedAt,
            evidence: emptyLinkEvidence(),
            id: input.id,
            workId: input.workId,
            workKey: currentValue.nextWorkKey,
            workTitle: plan.work.title,
          },
        };
      },
    );
    const { origin } = receipt.nextValue;
    if (!origin) {
      return null;
    }
    const current = await database.transaction((executor) =>
      readConversionSourceOf(
        executor,
        accountId,
        input.projectId,
        input.feedbackId,
      ),
    );
    return current ? { feedback: current.record, origin } : null;
  } catch (error) {
    if (error instanceof MutationTargetNotFoundError) {
      return null;
    }
    throw rethrowConversionError(error, input.feedbackId);
  }
}

function rethrowConversionError(error: unknown, feedbackId: string): unknown {
  const cause = error instanceof MutationApplyFailedError ? error.cause : error;
  if (
    cause instanceof MutationConflictError ||
    cause instanceof MutationStaleBaseRevisionError
  ) {
    return new FeedbackConversionStaleError(feedbackId);
  }
  return cause instanceof FeedbackProjectReadOnlyError ? cause : error;
}

/**
 * PostgreSQL adapter of the Feedback seam. It reads and writes only
 * `project_feedback` and its attachment references: no Work, relation or
 * Source table is touched, so a status change cannot reach planning.
 */
export function createDatabaseFeedbackStore(database: Database): FeedbackStore {
  return {
    convertToWork: (accountId, input) =>
      convertFeedbackToWork(database, accountId, input),

    readConversionSource(accountId, projectId, feedbackId) {
      return database.transaction(
        (executor) =>
          readConversionSourceOf(executor, accountId, projectId, feedbackId),
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    setEvidence(accountId, input) {
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
          );
        if (!current) {
          return null;
        }
        // The link is the `Origin` row of exactly this (Feedback, Work) pair.
        const [origin] = await executor
          .select({ id: feedbackWorkOrigin.id })
          .from(feedbackWorkOrigin)
          .where(
            and(
              eq(feedbackWorkOrigin.feedbackId, current.id),
              eq(feedbackWorkOrigin.workId, input.workId),
            ),
          )
          .for("update");
        if (!origin) {
          return null;
        }
        const [existing] = await executor
          .select()
          .from(feedbackWorkEvidence)
          .where(eq(feedbackWorkEvidence.originId, origin.id));
        const revision = existing?.revision ?? 0;
        if (
          input.expectedRevision !== undefined &&
          input.expectedRevision !== revision
        ) {
          throw new FeedbackRevisionConflictError(current.id);
        }
        const now = new Date();
        const actorAlias = await accountActorAlias(accountId);
        const merged = mergeLinkEvidence(
          {
            followUp: (existing?.followUp ??
              null) as FeedbackLinkEvidence["followUp"],
            quality: evidenceQualitySchema.parse({
              ...emptyEvidenceQuality(),
              ...(existing?.qualities as object | undefined),
            }),
            role: (existing?.role ??
              "Unspecified") as FeedbackLinkEvidence["role"],
          },
          input,
          { author: actorAlias, recordedAt: now.toISOString() },
        );
        if (merged.changedFields.length > 0) {
          const next = revision + 1;
          // Only the link's own rows are written; Feedback and Work rows stay untouched.
          await executor
            .insert(feedbackWorkEvidence)
            .values({
              createdAt: now,
              followUp: merged.followUp,
              originId: origin.id,
              qualities: merged.quality,
              revision: next,
              role: merged.role,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              set: {
                followUp: merged.followUp,
                qualities: merged.quality,
                revision: next,
                role: merged.role,
                updatedAt: now,
              },
              target: feedbackWorkEvidence.originId,
            });
          await executor.insert(feedbackWorkEvidenceHistory).values({
            actorAlias,
            changedAt: now,
            changedFields: merged.changedFields,
            id: crypto.randomUUID(),
            originId: origin.id,
            revision: next,
          });
        }
        const [record] = await toRecords(executor, [current]);
        return record ?? null;
      });
    },

    setIdentity(accountId, input) {
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
        if (
          input.expectedRevision !== undefined &&
          input.expectedRevision !== current.revision
        ) {
          throw new FeedbackRevisionConflictError(current.id);
        }
        await applyIdentity(executor, owned.workspaceId, current.id, input);
        const row = await requireOne(
          executor
            .update(feedback)
            .set({ revision: current.revision + 1, updatedAt: new Date() })
            .where(eq(feedback.id, current.id))
            .returning(),
          "Feedback identity was not updated.",
        );
        const [record] = await toRecords(executor, [row]);
        return record ?? null;
      });
    },

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
        const created = await insertFeedback(executor, owned, input);
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
