import {
  DEFAULT_VISUAL_VIEW,
  type VisualView,
  visualOriginKey,
} from "@cantiara/api/moodboard-view";
import {
  type Moodboard,
  type MoodboardItem,
  type MoodboardsAccess,
  moodboardSchema,
} from "@cantiara/api/moodboards";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
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
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";

import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";

export type MoodboardRecord = typeof moodboard.$inferSelect;

function toColorSwatch(
  item: typeof moodboardItem.$inferSelect,
  swatch: typeof moodboardColorSwatch.$inferSelect,
): MoodboardItem {
  return {
    color: swatch.color,
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    kind: "Color Swatch",
    note: swatch.note,
    paletteGroupId: swatch.paletteGroupId,
    position: item.position,
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * A stored view applies only to the exact origin it was bound to; a row for
 * any other origin reads as the unedited presentation.
 */
function toVisualView(
  origin: ReturnType<typeof toVisualOrigin>,
  row: typeof moodboardVisualView.$inferSelect | undefined,
): VisualView {
  if (!row || row.boundOrigin !== visualOriginKey(origin)) {
    return DEFAULT_VISUAL_VIEW;
  }
  const hasCrop =
    row.cropLeft !== null &&
    row.cropTop !== null &&
    row.cropWidth !== null &&
    row.cropHeight !== null;
  return {
    crop: hasCrop
      ? {
          height: row.cropHeight ?? 0,
          left: row.cropLeft ?? 0,
          top: row.cropTop ?? 0,
          width: row.cropWidth ?? 0,
        }
      : null,
    rotation: row.rotation as VisualView["rotation"],
  };
}

function toVisualOrigin(visual: typeof moodboardVisual.$inferSelect) {
  return visual.originKind === "External link" && visual.externalUrl
    ? ({ kind: "External link", url: visual.externalUrl } as const)
    : ({
        attachmentVersionId: visual.fileAttachmentVersionId ?? "",
        kind: "File Attachment version",
      } as const);
}

function toVisual(
  item: typeof moodboardItem.$inferSelect,
  visual: typeof moodboardVisual.$inferSelect,
  viewRow: typeof moodboardVisualView.$inferSelect | undefined,
): MoodboardItem {
  const origin = toVisualOrigin(visual);
  return {
    caption: visual.caption,
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    kind: "Visual",
    origin,
    position: item.position,
    updatedAt: item.updatedAt.toISOString(),
    view: toVisualView(origin, viewRow),
  };
}

export async function hydrateMoodboards(
  executor: MutationDatabaseExecutor,
  records: readonly MoodboardRecord[],
): Promise<Moodboard[]> {
  if (records.length === 0) {
    return [];
  }
  const moodboardIds = records.map(({ id }) => id);
  const visualRows = await executor
    .select({
      item: moodboardItem,
      view: moodboardVisualView,
      visual: moodboardVisual,
    })
    .from(moodboardItem)
    .innerJoin(moodboardVisual, eq(moodboardVisual.itemId, moodboardItem.id))
    .leftJoin(
      moodboardVisualView,
      eq(moodboardVisualView.itemId, moodboardItem.id),
    )
    .where(inArray(moodboardItem.moodboardId, moodboardIds));
  const swatchRows = await executor
    .select({ item: moodboardItem, swatch: moodboardColorSwatch })
    .from(moodboardItem)
    .innerJoin(
      moodboardColorSwatch,
      eq(moodboardColorSwatch.itemId, moodboardItem.id),
    )
    .where(inArray(moodboardItem.moodboardId, moodboardIds));
  const groupRows = await executor
    .select()
    .from(moodboardPaletteGroup)
    .where(inArray(moodboardPaletteGroup.moodboardId, moodboardIds))
    .orderBy(asc(moodboardPaletteGroup.position));
  const focusRows = await executor
    .select()
    .from(moodboardFocusStep)
    .where(inArray(moodboardFocusStep.moodboardId, moodboardIds))
    .orderBy(asc(moodboardFocusStep.position));
  return records.map((record) =>
    moodboardSchema.parse({
      createdAt: record.createdAt.toISOString(),
      focusOrder: focusRows
        .filter((step) => step.moodboardId === record.id)
        .map(({ itemId }) => itemId),
      id: record.id,
      items: [
        ...visualRows
          .filter(({ item }) => item.moodboardId === record.id)
          .map(({ item, view, visual }) =>
            toVisual(item, visual, view ?? undefined),
          ),
        ...swatchRows
          .filter(({ item }) => item.moodboardId === record.id)
          .map(({ item, swatch }) => toColorSwatch(item, swatch)),
      ].sort((left, right) => left.position - right.position),
      paletteGroups: groupRows
        .filter((group) => group.moodboardId === record.id)
        .map(({ id, name, position }) => ({ id, name, position })),
      projectId: record.projectId,
      revision: record.revision,
      title: record.title,
      updatedAt: record.updatedAt.toISOString(),
    }),
  );
}

/** Account-owned Moodboard record, optionally row-locked for a mutation. */
export async function findOwnedMoodboardRecord(
  executor: MutationDatabaseExecutor,
  accountId: string,
  moodboardId: string,
  lock: boolean,
): Promise<MoodboardRecord | null> {
  const query = executor
    .select({ moodboard })
    .from(moodboard)
    .innerJoin(project, eq(project.id, moodboard.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(moodboard.id, moodboardId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  const rows = lock
    ? await query.for("update", { of: moodboard })
    : await query;
  return rows[0]?.moodboard ?? null;
}

export async function loadMoodboard(
  executor: MutationDatabaseExecutor,
  record: MoodboardRecord,
): Promise<Moodboard> {
  const [hydrated] = await hydrateMoodboards(executor, [record]);
  if (!hydrated) {
    throw new Error("Moodboard could not be loaded.");
  }
  return hydrated;
}

export function createDatabaseMoodboards(database: Database): MoodboardsAccess {
  async function listWhere(where: SQL | undefined) {
    const rows = await database
      .select({ moodboard })
      .from(moodboard)
      .innerJoin(project, eq(project.id, moodboard.projectId))
      .innerJoin(workspace, eq(workspace.id, project.workspaceId))
      .where(where)
      .orderBy(desc(moodboard.createdAt), asc(moodboard.id));
    return hydrateMoodboards(
      database,
      rows.map((row) => row.moodboard),
    );
  }
  return {
    async get(accountId, moodboardId) {
      const [found] = await listWhere(
        and(
          eq(moodboard.id, moodboardId),
          eq(workspace.ownerAccountId, accountId),
        ),
      );
      return found ?? null;
    },
    async list(accountId, projectId) {
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!ownedProject) {
        return null;
      }
      return listWhere(
        and(
          eq(moodboard.projectId, projectId),
          eq(workspace.ownerAccountId, accountId),
        ),
      );
    },
  };
}
