import {
  addMoodboardVisualInputSchema,
  createMoodboardInputSchema,
  type MoodboardMutationContracts,
  type MoodboardMutationValue,
  type MoodboardVisualOrigin,
  updateMoodboardVisualCaptionInputSchema,
} from "@cantiara/api/moodboards";
import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import {
  moodboard,
  moodboardItem,
  moodboardVisual,
} from "@cantiara/db/schema/moodboard";
import { project } from "@cantiara/db/schema/project";
import { and, count, eq } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  findOwnedMoodboardRecord,
  loadMoodboard,
  type MoodboardRecord,
} from "./moodboards-database";

type MoodboardOperation = "addVisual" | "create" | "updateVisualCaption";
type ExistingOperation = Exclude<MoodboardOperation, "create">;
type MoodboardUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<MoodboardMutationValue>["update"]
>[1];

export class MoodboardProjectNotFoundError extends Error {
  readonly code = "MOODBOARD_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "MoodboardProjectNotFoundError";
  }
}

export class MoodboardVisualNotFoundError extends Error {
  readonly code = "MOODBOARD_VISUAL_NOT_FOUND" as const;

  constructor(itemId: string) {
    super(`Moodboard visual ${itemId} was not found.`);
    this.name = "MoodboardVisualNotFoundError";
  }
}

export class MoodboardOriginUnavailableError extends Error {
  readonly code = "MOODBOARD_ORIGIN_UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "MoodboardOriginUnavailableError";
  }
}

async function findOwnedProjectId(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  const rows = lock ? await query.for("update", { of: project }) : await query;
  return rows[0]?.id ?? null;
}

/**
 * The exact File Attachment version must be an image version of an Active
 * File Attachment in the same Project. External links need no lookup.
 */
async function assertOriginAvailable(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  origin: MoodboardVisualOrigin,
) {
  if (origin.kind === "External link") {
    return;
  }
  const [found] = await executor
    .select({ mimeType: fileAttachmentVersion.mimeType })
    .from(fileAttachmentVersion)
    .innerJoin(
      fileAttachment,
      eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
    )
    .innerJoin(workspace, eq(workspace.id, fileAttachment.workspaceId))
    .where(
      and(
        eq(fileAttachmentVersion.id, origin.attachmentVersionId),
        eq(fileAttachment.scopeType, "Project"),
        eq(fileAttachment.projectId, projectId),
        eq(fileAttachment.lifecycleStatus, "Active"),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  if (!found?.mimeType.startsWith("image/")) {
    throw new MoodboardOriginUnavailableError(
      "The File Attachment version is not an image in this Project.",
    );
  }
}

async function findCreateTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  payload: MutationPayload | undefined,
) {
  const parsed = createMoodboardInputSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  if (
    !(await findOwnedProjectId(
      executor,
      accountId,
      parsed.data.projectId,
      false,
    ))
  ) {
    throw new MoodboardProjectNotFoundError(parsed.data.projectId);
  }
  return {
    id: targetId,
    revision: 0,
    value: { moodboard: null },
  } satisfies MutationTarget<MoodboardMutationValue>;
}

async function validatePayload(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingOperation,
  record: MoodboardRecord,
  current: NonNullable<MoodboardMutationValue["moodboard"]>,
  payload: MutationPayload,
) {
  if (operation === "addVisual") {
    const parsed = addMoodboardVisualInputSchema.safeParse(payload);
    if (!parsed.success || parsed.data.moodboardId !== record.id) {
      return false;
    }
    await assertOriginAvailable(
      executor,
      accountId,
      record.projectId,
      parsed.data.origin,
    );
    return true;
  }
  const parsed = updateMoodboardVisualCaptionInputSchema.safeParse(payload);
  if (!parsed.success || parsed.data.moodboardId !== record.id) {
    return false;
  }
  if (!current.items.some((item) => item.id === parsed.data.itemId)) {
    throw new MoodboardVisualNotFoundError(parsed.data.itemId);
  }
  return true;
}

async function findExistingTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingOperation,
  targetId: string,
  lock: boolean,
  payload: MutationPayload | undefined,
) {
  const record = await findOwnedMoodboardRecord(
    executor,
    accountId,
    targetId,
    lock,
  );
  if (!record) {
    return null;
  }
  const current = await loadMoodboard(executor, record);
  if (
    payload !== undefined &&
    !(await validatePayload(
      executor,
      accountId,
      operation,
      record,
      current,
      payload,
    ))
  ) {
    return null;
  }
  return {
    id: record.id,
    revision: record.revision,
    value: { moodboard: current },
  } satisfies MutationTarget<MoodboardMutationValue>;
}

async function createMoodboardRecord(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: MoodboardUpdateInput,
) {
  const next = input.nextValue.moodboard;
  if (!next) {
    return null;
  }
  if (!(await findOwnedProjectId(executor, accountId, next.projectId, true))) {
    throw new MoodboardProjectNotFoundError(next.projectId);
  }
  const [created] = await executor
    .insert(moodboard)
    .values({
      createdAt: input.committedAt,
      id: input.targetId,
      projectId: next.projectId,
      revision: input.expectedRevision + 1,
      title: next.title,
      updatedAt: input.committedAt,
    })
    .returning();
  if (!created) {
    return null;
  }
  return {
    id: created.id,
    revision: created.revision,
    value: { moodboard: await loadMoodboard(executor, created) },
  } satisfies MutationTarget<MoodboardMutationValue>;
}

async function addVisualItem(
  executor: MutationDatabaseExecutor,
  accountId: string,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const added = input.nextValue.moodboard?.items.at(-1);
  if (added?.kind !== "Visual") {
    return false;
  }
  await assertOriginAvailable(
    executor,
    accountId,
    record.projectId,
    added.origin,
  );
  const [existing] = await executor
    .select({ total: count() })
    .from(moodboardItem)
    .where(eq(moodboardItem.moodboardId, record.id));
  await executor.insert(moodboardItem).values({
    createdAt: input.committedAt,
    id: added.id,
    kind: "Visual",
    moodboardId: record.id,
    position: existing?.total ?? 0,
    updatedAt: input.committedAt,
  });
  await executor.insert(moodboardVisual).values({
    caption: added.caption,
    externalUrl:
      added.origin.kind === "External link" ? added.origin.url : null,
    fileAttachmentVersionId:
      added.origin.kind === "File Attachment version"
        ? added.origin.attachmentVersionId
        : null,
    itemId: added.id,
    originKind: added.origin.kind,
  });
  return true;
}

/** Only the caption of the changed visual is written; its origin never moves. */
async function updateVisualCaptionItem(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const before = await loadMoodboard(executor, record);
  const changed = input.nextValue.moodboard?.items.find((item) => {
    const previous = before.items.find(({ id }) => id === item.id);
    return (
      item.kind === "Visual" && previous && previous.caption !== item.caption
    );
  });
  if (!changed) {
    // A repeated caption is a no-op that still advances the Moodboard revision.
    return true;
  }
  if (changed.kind !== "Visual") {
    return false;
  }
  await executor
    .update(moodboardItem)
    .set({ updatedAt: input.committedAt })
    .where(
      and(
        eq(moodboardItem.id, changed.id),
        eq(moodboardItem.moodboardId, record.id),
      ),
    );
  await executor
    .update(moodboardVisual)
    .set({ caption: changed.caption })
    .where(eq(moodboardVisual.itemId, changed.id));
  return true;
}

async function updateExistingMoodboard(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingOperation,
  input: MoodboardUpdateInput,
) {
  const record = await findOwnedMoodboardRecord(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (!record || record.revision !== input.expectedRevision) {
    return null;
  }
  const written =
    operation === "addVisual"
      ? await addVisualItem(executor, accountId, record, input)
      : await updateVisualCaptionItem(executor, record, input);
  if (!written) {
    return null;
  }
  const [updated] = await executor
    .update(moodboard)
    .set({
      revision: input.expectedRevision + 1,
      updatedAt: input.committedAt,
    })
    .where(
      and(
        eq(moodboard.id, record.id),
        eq(moodboard.revision, input.expectedRevision),
      ),
    )
    .returning();
  if (!updated) {
    return null;
  }
  return {
    id: updated.id,
    revision: updated.revision,
    value: { moodboard: await loadMoodboard(executor, updated) },
  } satisfies MutationTarget<MoodboardMutationValue>;
}

function createMoodboardTarget(
  accountId: string,
  operation: MoodboardOperation,
): MutationDatabaseTargetAdapter<MoodboardMutationValue> {
  return {
    find(executor, targetId, lock, context) {
      return operation === "create"
        ? findCreateTarget(executor, accountId, targetId, context?.payload)
        : findExistingTarget(
            executor,
            accountId,
            operation,
            targetId,
            lock,
            context?.payload,
          );
    },
    update(executor, input) {
      return operation === "create"
        ? createMoodboardRecord(executor, accountId, input)
        : updateExistingMoodboard(executor, accountId, operation, input);
    },
  };
}

export function createDatabaseMoodboardMutationContracts(
  database: Database,
): MoodboardMutationContracts {
  function contract(operation: MoodboardOperation, accountId: string) {
    return createDatabaseMutationContract<MoodboardMutationValue>(database, {
      target: createMoodboardTarget(accountId, operation),
    });
  }
  return {
    addVisual: (accountId) => contract("addVisual", accountId),
    create: (accountId) => contract("create", accountId),
    updateVisualCaption: (accountId) =>
      contract("updateVisualCaption", accountId),
  };
}
