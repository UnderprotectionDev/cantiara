import { visualOriginKey } from "@cantiara/api/moodboard-view";
import {
  addColorSwatchInputSchema,
  addMoodboardVisualInputSchema,
  addPaletteGroupInputSchema,
  assignColorSwatchPaletteGroupInputSchema,
  createMoodboardInputSchema,
  type MoodboardMutationContracts,
  type MoodboardMutationValue,
  type MoodboardVisualOrigin,
  reorderMoodboardItemsInputSchema,
  setMoodboardFocusOrderInputSchema,
  setMoodboardVisualViewInputSchema,
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
  moodboardColorSwatch,
  moodboardFocusStep,
  moodboardItem,
  moodboardPaletteGroup,
  moodboardVisual,
  moodboardVisualView,
} from "@cantiara/db/schema/moodboard";
import { project } from "@cantiara/db/schema/project";
import { and, count, eq, inArray, sql } from "drizzle-orm";

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

type MoodboardOperation =
  | "addColorSwatch"
  | "addPaletteGroup"
  | "addVisual"
  | "assignColorSwatchPaletteGroup"
  | "create"
  | "reorderItems"
  | "setFocusOrder"
  | "setVisualView"
  | "updateVisualCaption";
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

export class MoodboardSwatchNotFoundError extends Error {
  readonly code = "MOODBOARD_SWATCH_NOT_FOUND" as const;

  constructor(itemId: string) {
    super(`Moodboard Color Swatch ${itemId} was not found.`);
    this.name = "MoodboardSwatchNotFoundError";
  }
}

export class MoodboardPaletteGroupNotFoundError extends Error {
  readonly code = "MOODBOARD_PALETTE_GROUP_NOT_FOUND" as const;

  constructor(groupId: string) {
    super(`Moodboard Palette group ${groupId} was not found.`);
    this.name = "MoodboardPaletteGroupNotFoundError";
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

function assertPaletteGroupExists(
  current: NonNullable<MoodboardMutationValue["moodboard"]>,
  paletteGroupId: string | null,
) {
  if (
    paletteGroupId !== null &&
    !current.paletteGroups.some(({ id }) => id === paletteGroupId)
  ) {
    throw new MoodboardPaletteGroupNotFoundError(paletteGroupId);
  }
}

function validateViewPayload(
  operation: "setFocusOrder" | "setVisualView" | "updateVisualCaption",
  record: MoodboardRecord,
  current: NonNullable<MoodboardMutationValue["moodboard"]>,
  payload: MutationPayload,
) {
  if (operation === "setVisualView") {
    const parsed = setMoodboardVisualViewInputSchema.safeParse(payload);
    if (!parsed.success || parsed.data.moodboardId !== record.id) {
      return false;
    }
    if (
      !current.items.some(
        (item) => item.kind === "Visual" && item.id === parsed.data.itemId,
      )
    ) {
      throw new MoodboardVisualNotFoundError(parsed.data.itemId);
    }
    return true;
  }
  if (operation === "updateVisualCaption") {
    const parsed = updateMoodboardVisualCaptionInputSchema.safeParse(payload);
    if (!parsed.success || parsed.data.moodboardId !== record.id) {
      return false;
    }
    if (
      !current.items.some(
        (item) => item.kind === "Visual" && item.id === parsed.data.itemId,
      )
    ) {
      throw new MoodboardVisualNotFoundError(parsed.data.itemId);
    }
    return true;
  }
  const parsed = setMoodboardFocusOrderInputSchema.safeParse(payload);
  if (!parsed.success || parsed.data.moodboardId !== record.id) {
    return false;
  }
  const known = new Set(current.items.map(({ id }) => id));
  const unknown = parsed.data.itemIds.find((id) => !known.has(id));
  if (unknown !== undefined) {
    throw new MoodboardVisualNotFoundError(unknown);
  }
  return true;
}

/** The order must be exactly the current items: nothing created or dropped. */
function validateReorderPayload(
  record: MoodboardRecord,
  current: NonNullable<MoodboardMutationValue["moodboard"]>,
  payload: MutationPayload,
) {
  const parsed = reorderMoodboardItemsInputSchema.safeParse(payload);
  if (!parsed.success || parsed.data.moodboardId !== record.id) {
    return false;
  }
  const known = new Set(current.items.map(({ id }) => id));
  const unknown = parsed.data.itemIds.find((id) => !known.has(id));
  if (unknown !== undefined) {
    throw new MoodboardVisualNotFoundError(unknown);
  }
  return parsed.data.itemIds.length === known.size;
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
  if (operation === "addColorSwatch") {
    const parsed = addColorSwatchInputSchema.safeParse(payload);
    if (!parsed.success || parsed.data.moodboardId !== record.id) {
      return false;
    }
    assertPaletteGroupExists(current, parsed.data.paletteGroupId);
    return true;
  }
  if (operation === "addPaletteGroup") {
    const parsed = addPaletteGroupInputSchema.safeParse(payload);
    return parsed.success && parsed.data.moodboardId === record.id;
  }
  if (operation === "assignColorSwatchPaletteGroup") {
    const parsed = assignColorSwatchPaletteGroupInputSchema.safeParse(payload);
    if (!parsed.success || parsed.data.moodboardId !== record.id) {
      return false;
    }
    if (
      !current.items.some(
        (item) =>
          item.kind === "Color Swatch" && item.id === parsed.data.itemId,
      )
    ) {
      throw new MoodboardSwatchNotFoundError(parsed.data.itemId);
    }
    assertPaletteGroupExists(current, parsed.data.paletteGroupId);
    return true;
  }
  if (operation === "reorderItems") {
    return validateReorderPayload(record, current, payload);
  }
  return validateViewPayload(operation, record, current, payload);
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

async function addColorSwatchItem(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const added = input.nextValue.moodboard?.items.at(-1);
  if (added?.kind !== "Color Swatch") {
    return false;
  }
  const [existing] = await executor
    .select({ total: count() })
    .from(moodboardItem)
    .where(eq(moodboardItem.moodboardId, record.id));
  await executor.insert(moodboardItem).values({
    createdAt: input.committedAt,
    id: added.id,
    kind: "Color Swatch",
    moodboardId: record.id,
    position: existing?.total ?? 0,
    updatedAt: input.committedAt,
  });
  await executor.insert(moodboardColorSwatch).values({
    color: added.color,
    itemId: added.id,
    moodboardId: record.id,
    note: added.note,
    paletteGroupId: added.paletteGroupId,
  });
  return true;
}

async function addPaletteGroupRow(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const added = input.nextValue.moodboard?.paletteGroups.at(-1);
  if (!added) {
    return false;
  }
  const [existing] = await executor
    .select({ total: count() })
    .from(moodboardPaletteGroup)
    .where(eq(moodboardPaletteGroup.moodboardId, record.id));
  await executor.insert(moodboardPaletteGroup).values({
    createdAt: input.committedAt,
    id: added.id,
    moodboardId: record.id,
    name: added.name,
    position: existing?.total ?? 0,
  });
  return true;
}

/** Only the membership of the changed swatch is written. */
async function assignSwatchGroupItem(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const before = await loadMoodboard(executor, record);
  const changed = input.nextValue.moodboard?.items.find((item) => {
    const previous = before.items.find(({ id }) => id === item.id);
    return (
      item.kind === "Color Swatch" &&
      previous?.kind === "Color Swatch" &&
      previous.paletteGroupId !== item.paletteGroupId
    );
  });
  if (!changed) {
    // A repeated assignment is a no-op that still advances the revision.
    return true;
  }
  if (changed.kind !== "Color Swatch") {
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
    .update(moodboardColorSwatch)
    .set({ paletteGroupId: changed.paletteGroupId })
    .where(eq(moodboardColorSwatch.itemId, changed.id));
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
      item.kind === "Visual" &&
      previous?.kind === "Visual" &&
      previous.caption !== item.caption
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

/**
 * Writes only this Moodboard's view row of the targeted visual, bound to its
 * exact origin. The File Attachment, its versions, and other Moodboards are not
 * read for writing; a default view removes the row (Reset view).
 */
async function setVisualViewItem(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const before = await loadMoodboard(executor, record);
  const next = input.nextValue.moodboard?.items.find(
    (item) =>
      item.kind === "Visual" &&
      before.items.some(
        (previous) =>
          previous.kind === "Visual" &&
          previous.id === item.id &&
          (previous.view.rotation !== item.view.rotation ||
            JSON.stringify(previous.view.crop) !==
              JSON.stringify(item.view.crop)),
      ),
  );
  if (!next) {
    // A repeated view is a no-op that still advances the Moodboard revision.
    return true;
  }
  if (next.kind !== "Visual") {
    return false;
  }
  await executor
    .update(moodboardItem)
    .set({ updatedAt: input.committedAt })
    .where(
      and(
        eq(moodboardItem.id, next.id),
        eq(moodboardItem.moodboardId, record.id),
      ),
    );
  if (next.view.crop === null && next.view.rotation === 0) {
    await executor
      .delete(moodboardVisualView)
      .where(eq(moodboardVisualView.itemId, next.id));
    return true;
  }
  const values = {
    boundOrigin: visualOriginKey(next.origin),
    cropHeight: next.view.crop?.height ?? null,
    cropLeft: next.view.crop?.left ?? null,
    cropTop: next.view.crop?.top ?? null,
    cropWidth: next.view.crop?.width ?? null,
    rotation: next.view.rotation,
    updatedAt: input.committedAt,
  };
  await executor
    .insert(moodboardVisualView)
    .values({ itemId: next.id, ...values })
    .onConflictDoUpdate({ set: values, target: moodboardVisualView.itemId });
  return true;
}

/** Rewrites only the ordered ID list; no item or content row is copied. */
async function setFocusOrderRows(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const order = input.nextValue.moodboard?.focusOrder;
  if (!order) {
    return false;
  }
  await executor
    .delete(moodboardFocusStep)
    .where(eq(moodboardFocusStep.moodboardId, record.id));
  if (order.length > 0) {
    await executor.insert(moodboardFocusStep).values(
      order.map((itemId, position) => ({
        itemId,
        moodboardId: record.id,
        position,
      })),
    );
  }
  return true;
}

/**
 * Rewrites only item positions. The unique (moodboard, position) index forces
 * two steps: park every position above the range, then assign the new order in
 * one statement.
 */
async function reorderItemRows(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
  input: MoodboardUpdateInput,
) {
  const order = input.nextValue.moodboard?.items.map(({ id }) => id);
  if (!order) {
    return false;
  }
  if (order.length === 0) {
    return true;
  }
  await executor
    .update(moodboardItem)
    .set({ position: sql`${moodboardItem.position} + ${order.length}` })
    .where(eq(moodboardItem.moodboardId, record.id));
  const cases = order.map(
    (itemId, position) =>
      sql`when ${moodboardItem.id} = ${itemId} then ${position}::integer`,
  );
  await executor
    .update(moodboardItem)
    .set({
      position: sql`case ${sql.join(cases, sql` `)} else ${moodboardItem.position} end`,
    })
    .where(
      and(
        eq(moodboardItem.moodboardId, record.id),
        inArray(moodboardItem.id, order),
      ),
    );
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
  let written: boolean;
  switch (operation) {
    case "addColorSwatch":
      written = await addColorSwatchItem(executor, record, input);
      break;
    case "addPaletteGroup":
      written = await addPaletteGroupRow(executor, record, input);
      break;
    case "addVisual":
      written = await addVisualItem(executor, accountId, record, input);
      break;
    case "assignColorSwatchPaletteGroup":
      written = await assignSwatchGroupItem(executor, record, input);
      break;
    case "reorderItems":
      written = await reorderItemRows(executor, record, input);
      break;
    case "setFocusOrder":
      written = await setFocusOrderRows(executor, record, input);
      break;
    case "setVisualView":
      written = await setVisualViewItem(executor, record, input);
      break;
    default:
      written = await updateVisualCaptionItem(executor, record, input);
  }
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
    addColorSwatch: (accountId) => contract("addColorSwatch", accountId),
    addPaletteGroup: (accountId) => contract("addPaletteGroup", accountId),
    addVisual: (accountId) => contract("addVisual", accountId),
    assignColorSwatchPaletteGroup: (accountId) =>
      contract("assignColorSwatchPaletteGroup", accountId),
    create: (accountId) => contract("create", accountId),
    reorderItems: (accountId) => contract("reorderItems", accountId),
    setFocusOrder: (accountId) => contract("setFocusOrder", accountId),
    setVisualView: (accountId) => contract("setVisualView", accountId),
    updateVisualCaption: (accountId) =>
      contract("updateVisualCaption", accountId),
  };
}
