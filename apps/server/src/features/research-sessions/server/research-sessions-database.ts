// biome-ignore-all lint/performance/noAwaitInLoops: Exact new file versions are validated and locked within the atomic session commit.
import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  captureResearchSessionContent,
  captureResearchSessionInputSchema,
  type ResearchSessionRecord,
  type ResearchSessionsAccess,
  researchSessionRecordSchema,
  saveResearchSessionInputSchema,
} from "@cantiara/api/research-sessions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import { researchSession } from "@cantiara/db/schema/research-session";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { MutationConflictError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

interface ResearchSessionMutationValue {
  session: ResearchSessionRecord | null;
}
export interface ResearchSessionContacts {
  isAvailable: (
    executor: MutationDatabaseExecutor,
    accountId: string,
    contactId: string,
  ) => Promise<boolean>;
}

async function ownedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  const [row] = lock ? await query.for("update", { of: project }) : await query;
  return row?.project ?? null;
}

function projectIdFromPayload(payload?: MutationPayload) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "projectId" in payload &&
    typeof payload.projectId === "string"
  ) {
    return payload.projectId;
  }
  return null;
}

async function validateNewFiles(
  executor: MutationDatabaseExecutor,
  session: ResearchSessionRecord,
  workspaceId: string,
) {
  const [previousRow] = await executor
    .select()
    .from(researchSession)
    .where(eq(researchSession.id, session.id));
  const previous = previousRow
    ? researchSessionRecordSchema.parse(previousRow.data)
    : null;
  const previousIds = new Set(previous?.content.map((item) => item.content.id));
  for (const item of session.content) {
    if (
      item.content.kind !== "File Attachment" ||
      previousIds.has(item.content.id)
    ) {
      continue;
    }
    const [file] = await executor
      .select({ id: fileAttachmentVersion.id })
      .from(fileAttachmentVersion)
      .innerJoin(
        fileAttachment,
        eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
      )
      .where(
        and(
          eq(fileAttachmentVersion.id, item.content.fileVersionId),
          eq(fileAttachment.id, item.content.fileId),
          eq(fileAttachment.projectId, session.projectId),
          eq(fileAttachment.workspaceId, workspaceId),
          eq(fileAttachment.lifecycleStatus, "Active"),
        ),
      )
      .for("update", { of: fileAttachment });
    if (!file) {
      throw new ORPCError("NOT_FOUND", {
        message: "File Attachment is unavailable.",
      });
    }
  }
}

function sessionTarget(
  accountId: string,
  contacts?: ResearchSessionContacts,
): MutationDatabaseTargetAdapter<ResearchSessionMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      const projectId = projectIdFromPayload(context?.payload);
      if (!projectId) {
        return null;
      }
      const owner = await ownedProject(executor, accountId, projectId, lock);
      if (!owner || owner.archivedAt) {
        return null;
      }
      const query = executor
        .select()
        .from(researchSession)
        .where(
          and(
            eq(researchSession.id, targetId),
            eq(researchSession.projectId, projectId),
          ),
        );
      const [row] = lock ? await query.for("update") : await query;
      return {
        id: targetId,
        revision: row?.revision ?? 0,
        value: {
          session: row ? researchSessionRecordSchema.parse(row.data) : null,
        },
      };
    },
    async update(executor, input) {
      const { session } = input.nextValue;
      if (!session || session.id !== input.targetId) {
        return null;
      }
      const owner = await ownedProject(
        executor,
        accountId,
        session.projectId,
        true,
      );
      if (!owner || owner.archivedAt) {
        return null;
      }
      if (
        session.participantContactId &&
        !(await contacts?.isAvailable(
          executor,
          accountId,
          session.participantContactId,
        ))
      ) {
        throw new ORPCError("NOT_FOUND", {
          message: "Contact is unavailable.",
        });
      }
      await validateNewFiles(executor, session, owner.workspaceId);
      const fields = {
        id: session.id,
        projectId: session.projectId,
        revision: session.revision,
        data: session,
      };
      const [row] =
        input.expectedRevision === 0
          ? await executor
              .insert(researchSession)
              .values(fields)
              .onConflictDoNothing()
              .returning()
          : await executor
              .update(researchSession)
              .set(fields)
              .where(
                and(
                  eq(researchSession.id, session.id),
                  eq(researchSession.projectId, session.projectId),
                  eq(researchSession.revision, input.expectedRevision),
                ),
              )
              .returning();
      return row
        ? {
            id: row.id,
            revision: row.revision,
            value: { session: researchSessionRecordSchema.parse(row.data) },
          }
        : null;
    },
  };
}

export function createDatabaseResearchSessions(
  database: Database,
  contacts?: ResearchSessionContacts,
): ResearchSessionsAccess {
  function mutation(accountId: string) {
    return createDatabaseMutationContract<ResearchSessionMutationValue>(
      database,
      {
        target: sessionTarget(accountId, contacts),
      },
    );
  }
  return {
    async list(accountId, projectId) {
      const owner = await ownedProject(database, accountId, projectId, false);
      if (!owner) {
        return null;
      }
      const rows = await database
        .select()
        .from(researchSession)
        .where(eq(researchSession.projectId, projectId))
        .orderBy(asc(researchSession.id));
      return {
        records: rows.map((row) => researchSessionRecordSchema.parse(row.data)),
        readOnly: owner.archivedAt !== null,
      };
    },
    async save(accountId, rawInput) {
      const input = saveResearchSessionInputSchema.parse(rawInput);
      const receipt = await mutation(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId: input.id,
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            operation: "save-research-session",
            projectId: input.projectId,
            fields: input.fields,
          },
        },
        ({ currentValue, currentRevision, committedAt }) => {
          const previous = currentValue.session;
          const consentChanged =
            !previous ||
            previous.consent !== input.fields.consent ||
            previous.consentNote !== input.fields.consentNote;
          return {
            session: researchSessionRecordSchema.parse({
              ...input.fields,
              id: input.id,
              projectId: input.projectId,
              sourceType: "Research Session",
              revision: currentRevision + 1,
              createdAt: previous?.createdAt ?? committedAt,
              updatedAt: committedAt,
              consentRecordedBy: consentChanged
                ? accountId
                : previous.consentRecordedBy,
              consentRecordedAt: consentChanged
                ? committedAt
                : previous.consentRecordedAt,
              participantConsentAtLink:
                previous?.participantContactId ===
                input.fields.participantContactId
                  ? previous.participantConsentAtLink
                  : input.fields.consent,
              content: previous?.content ?? [],
            }),
          };
        },
      );
      return researchSessionRecordSchema.parse(receipt.nextValue.session);
    },
    async capture(accountId, rawInput) {
      const input = captureResearchSessionInputSchema.parse(rawInput);
      const receipt = await mutation(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId: input.id,
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            operation: "capture-research-session-content",
            projectId: input.projectId,
            content: input.content,
          },
        },
        ({ currentValue, currentRevision, committedAt }) => {
          const current = currentValue.session;
          if (
            !current ||
            current.content.some((item) => item.content.id === input.content.id)
          ) {
            throw new MutationConflictError(input.id);
          }
          const captured = captureResearchSessionContent(
            current.consent,
            input.content,
          );
          return {
            session: researchSessionRecordSchema.parse({
              ...current,
              revision: currentRevision + 1,
              updatedAt: committedAt,
              content: [...current.content, captured],
            }),
          };
        },
      );
      return researchSessionRecordSchema.parse(receipt.nextValue.session);
    },
  };
}
