// biome-ignore-all lint/performance/noAwaitInLoops: Exact new file versions are validated and locked within the atomic session commit.

import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  confirmResearchSessionBindingInputSchema,
  previewResearchSessionBinding,
  previewResearchSessionBindingInputSchema,
  type ResearchEvidenceBinding,
  type ResearchSessionBindingsAccess,
  researchBindingPlanSchema,
  researchEvidenceBindingSchema,
} from "@cantiara/api/research-session-bindings";
import {
  captureResearchSessionContent,
  captureResearchSessionInputSchema,
  type ResearchSessionRecord,
  type ResearchSessionsAccess,
  researchSessionConvertPreview,
  researchSessionRecordSchema,
  saveResearchSessionInputSchema,
  saveResearchSessionNoteInputSchema,
} from "@cantiara/api/research-sessions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { evidenceBinding, recordOrigin } from "@cantiara/db/schema/evidence";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { project } from "@cantiara/db/schema/project";
import {
  researchSession,
  researchSessionBindingPreview,
} from "@cantiara/db/schema/research-session";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { MutationConflictError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { commitResearchSessionBinding } from "./research-binding-commit";
import {
  listResearchBindingTargets,
  researchBindingTarget,
} from "./research-binding-targets";

interface ResearchSessionMutationValue {
  binding?: ResearchEvidenceBinding;
  bindingPreviewId?: string;
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
    committedValue: (target) => target.value,
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
      const binding = input.nextValue.bindingPreviewId
        ? await commitResearchSessionBinding(executor, {
            previewId: input.nextValue.bindingPreviewId,
            session,
            accountId,
            workspaceId: owner.workspaceId,
            baseRevision: input.expectedRevision,
            committedAt: input.committedAt,
            idempotencyKey: input.idempotencyKey.key,
            payloadFingerprint: input.payloadFingerprint,
          })
        : undefined;
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
            value: {
              session: researchSessionRecordSchema.parse(row.data),
              ...(binding ? { binding } : {}),
            },
          }
        : null;
    },
  };
}

export function createDatabaseResearchSessions(
  database: Database,
  contacts?: ResearchSessionContacts,
): ResearchSessionsAccess & ResearchSessionBindingsAccess {
  function mutation(accountId: string) {
    return createDatabaseMutationContract<ResearchSessionMutationValue>(
      database,
      {
        target: sessionTarget(accountId, contacts),
      },
    );
  }
  async function readSession(
    accountId: string,
    input: { id: string; projectId: string },
  ) {
    const owner = await ownedProject(
      database,
      accountId,
      input.projectId,
      false,
    );
    if (!owner) {
      throw new ORPCError("NOT_FOUND");
    }
    const [row] = await database
      .select()
      .from(researchSession)
      .where(
        and(
          eq(researchSession.id, input.id),
          eq(researchSession.projectId, input.projectId),
        ),
      );
    if (!row) {
      throw new ORPCError("NOT_FOUND");
    }
    return { owner, session: researchSessionRecordSchema.parse(row.data) };
  }
  return {
    async bindingTargets(accountId, input) {
      const { owner } = await readSession(accountId, input);
      return listResearchBindingTargets(database, owner.workspaceId);
    },
    async previewBinding(accountId, rawInput) {
      const input = previewResearchSessionBindingInputSchema.parse(rawInput);
      const { owner, session } = await readSession(accountId, input);
      if (owner.archivedAt) {
        throw new ORPCError("FORBIDDEN");
      }
      if (input.baseRevision !== session.revision) {
        throw new MutationConflictError(input.id);
      }
      const plan = previewResearchSessionBinding(session, input);
      const target = await researchBindingTarget(
        database,
        accountId,
        plan.target,
        false,
      );
      if (owner.workspaceId !== target.project.workspaceId) {
        throw new ORPCError("NOT_FOUND");
      }
      const previewId = crypto.randomUUID();
      await database.insert(researchSessionBindingPreview).values({
        id: previewId,
        accountId,
        sessionId: session.id,
        projectId: session.projectId,
        plan,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      });
      return {
        previewId,
        plan,
        targetProjectName: target.project.name,
        targetLabel: target.label,
      };
    },
    async confirmBinding(accountId, rawInput) {
      const input = confirmResearchSessionBindingInputSchema.parse(rawInput);
      const { session, owner } = await readSession(accountId, input);
      if (owner.archivedAt) {
        throw new ORPCError("FORBIDDEN");
      }
      const [preview] = await database
        .select()
        .from(researchSessionBindingPreview)
        .where(
          and(
            eq(researchSessionBindingPreview.id, input.previewId),
            eq(researchSessionBindingPreview.accountId, accountId),
            eq(researchSessionBindingPreview.sessionId, input.id),
            eq(researchSessionBindingPreview.projectId, input.projectId),
          ),
        );
      if (!preview) {
        throw new ORPCError("NOT_FOUND");
      }
      const plan = researchBindingPlanSchema.parse(preview.plan);
      const { componentId } = plan.pin.source;
      if (!componentId) {
        throw new MutationConflictError(input.id);
      }
      researchSessionConvertPreview(session, componentId);
      const receipt = await mutation(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId: input.id,
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            operation: "confirm-research-binding",
            projectId: input.projectId,
            previewId: input.previewId,
          },
        },
        ({ currentValue, currentRevision, committedAt }) => {
          if (!currentValue.session) {
            throw new MutationConflictError(input.id);
          }
          return {
            session: {
              ...currentValue.session,
              revision: currentRevision + 1,
              updatedAt: committedAt,
            },
            bindingPreviewId: input.previewId,
          };
        },
      );
      return researchEvidenceBindingSchema.parse(receipt.nextValue.binding);
    },
    async listBindings(accountId, input) {
      const { session } = await readSession(accountId, input);
      const rows = await database
        .select({ evidence: evidenceBinding, origin: recordOrigin.id })
        .from(evidenceBinding)
        .leftJoin(
          recordOrigin,
          eq(recordOrigin.evidenceBindingId, evidenceBinding.id),
        )
        .where(
          and(
            eq(evidenceBinding.sourceRecordId, input.id),
            eq(evidenceBinding.sourceProjectId, input.projectId),
          ),
        )
        .orderBy(asc(evidenceBinding.createdAt), asc(evidenceBinding.id));
      const bindings = await Promise.all(
        rows.map(async ({ evidence, origin }) => {
          const pin = researchBindingPlanSchema.shape.pin.parse(evidence.pin);
          try {
            if (!pin.source.componentId) {
              return null;
            }
            researchSessionConvertPreview(session, pin.source.componentId);
            const target = await researchBindingTarget(
              database,
              accountId,
              {
                mode: "bind",
                type: researchEvidenceBindingSchema.shape.target.shape.type.parse(
                  evidence.targetRecordType,
                ),
                projectId: evidence.targetProjectId,
                recordId: evidence.targetRecordId,
              },
              false,
            );
            return researchEvidenceBindingSchema.parse({
              id: evidence.id,
              pin,
              actorId: evidence.actorId,
              createdAt: evidence.createdAt.toISOString(),
              origin: !!origin,
              target: {
                recordId: evidence.targetRecordId,
                projectId: evidence.targetProjectId,
                type: evidence.targetRecordType,
                label: target.label,
              },
            });
          } catch {
            return null;
          }
        }),
      );
      return bindings.filter(
        (binding): binding is ResearchEvidenceBinding => binding !== null,
      );
    },
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
    async saveNote(accountId, rawInput) {
      const input = saveResearchSessionNoteInputSchema.parse(rawInput);
      const receipt = await mutation(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          kind: "human",
          targetId: input.id,
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            operation: "save-research-session-note",
            projectId: input.projectId,
            note: input.note,
            create: input.create,
          },
        },
        ({ currentValue, currentRevision, committedAt }) => {
          const current = currentValue.session;
          const previous = current?.content.find(
            (item) => item.content.id === input.note.id,
          );
          if (
            !current ||
            (input.create ? !!previous : !previous) ||
            (previous && previous.content.kind !== input.note.kind)
          ) {
            throw new MutationConflictError(input.id);
          }
          const captured = captureResearchSessionContent(
            current.consent,
            input.note,
          );
          // Editing never upgrades the capture-time permission of existing bytes.
          if (previous) {
            captured.consentAtCapture = previous.consentAtCapture;
            captured.content.relationIds = previous.content.relationIds;
          }
          return {
            session: researchSessionRecordSchema.parse({
              ...current,
              revision: currentRevision + 1,
              updatedAt: committedAt,
              content: input.create
                ? [...current.content, captured]
                : current.content.map((item) =>
                    item.content.id === input.note.id ? captured : item,
                  ),
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
