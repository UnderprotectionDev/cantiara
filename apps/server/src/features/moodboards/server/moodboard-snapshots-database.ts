import {
  buildSnapshotPreview,
  MoodboardSnapshotError,
  type MoodboardSnapshotExportInput,
  type MoodboardSnapshotOutput,
  type MoodboardSnapshotPreview,
  type MoodboardSnapshotPreviewInput,
  type MoodboardSnapshotsAccess,
  planSnapshot,
  snapshotPageCount,
} from "@cantiara/api/moodboard-snapshot";
import type { Moodboard } from "@cantiara/api/moodboards";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { and, eq } from "drizzle-orm";

import type { FileAttachmentObjectStore } from "../../file-attachments/server/file-attachments";
import {
  playwrightSnapshotRenderer,
  presentVisualBytes,
  type SnapshotRenderer,
  type SnapshotRenderPage,
  type SnapshotTile,
} from "./moodboard-snapshot-render";
import { createDatabaseMoodboards } from "./moodboards-database";

/** Bounds one export: more selected visuals than this is refused, not truncated. */
export const MOODBOARD_SNAPSHOT_MAX_VISUALS = 60;

export interface MoodboardSnapshotDependencies {
  /** Original bytes of one exact File Attachment version, or null if unreadable. */
  loadOriginalBytes: (
    attachmentVersionId: string,
  ) => Promise<Uint8Array | null>;
  now: () => Date;
  renderer: SnapshotRenderer;
}

function assertSelectionBelongsToMoodboard(
  moodboard: Moodboard,
  itemIds: readonly string[],
) {
  const known = new Set(moodboard.items.map(({ id }) => id));
  if (itemIds.some((id) => !known.has(id))) {
    throw new MoodboardSnapshotError(
      "The selection includes an item that is not on this Moodboard.",
    );
  }
  if (planSnapshot(moodboard, itemIds).length === 0) {
    throw new MoodboardSnapshotError("Select at least one item.");
  }
}

function slug(value: string) {
  const text = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return text === "" ? "moodboard" : text.slice(0, 40);
}

async function tileFor(
  itemId: string,
  moodboard: Moodboard,
  dependencies: MoodboardSnapshotDependencies,
): Promise<SnapshotTile> {
  const item = moodboard.items.find(({ id }) => id === itemId);
  if (item?.kind === "Color Swatch") {
    return { color: item.color, kind: "swatch", note: item.note };
  }
  if (item?.kind !== "Visual") {
    throw new MoodboardSnapshotError("The selection is unavailable.");
  }
  if (item.origin.kind === "External link") {
    // External links are never fetched and never printed: the snapshot is
    // static and carries no live source link.
    return {
      caption: item.caption,
      kind: "placeholder",
      label: "External link visual (not embedded)",
    };
  }
  const original = await dependencies.loadOriginalBytes(
    item.origin.attachmentVersionId,
  );
  if (!original) {
    return {
      caption: item.caption,
      kind: "placeholder",
      label: "Original unavailable",
    };
  }
  try {
    const presented = await presentVisualBytes(original, item.view);
    return {
      caption: item.caption,
      dataUri: `data:image/png;base64,${Buffer.from(presented).toString("base64")}`,
      kind: "image",
    };
  } catch {
    return {
      caption: item.caption,
      kind: "placeholder",
      label: "Image could not be presented",
    };
  }
}

export function previewMoodboardSnapshot(
  moodboard: Moodboard,
  itemIds: readonly string[],
  now: Date,
): MoodboardSnapshotPreview {
  assertSelectionBelongsToMoodboard(moodboard, itemIds);
  return buildSnapshotPreview(moodboard, itemIds, now);
}

/**
 * Builds the static snapshot output from one Moodboard value. It only reads:
 * original bytes are loaded, presented in memory, and rendered; no Moodboard,
 * File Attachment, or version row is written.
 */
export async function buildMoodboardSnapshotOutput(
  moodboard: Moodboard,
  input: Pick<MoodboardSnapshotExportInput, "format" | "itemIds">,
  dependencies: MoodboardSnapshotDependencies,
): Promise<MoodboardSnapshotOutput> {
  assertSelectionBelongsToMoodboard(moodboard, input.itemIds);
  const now = dependencies.now();
  const preview = buildSnapshotPreview(moodboard, input.itemIds, now);
  const sections = planSnapshot(moodboard, input.itemIds);
  const visualCount = sections
    .filter(({ key }) => key === "visuals")
    .reduce(
      (count, { pages: sectionPages }) =>
        count +
        sectionPages.reduce((sum, page) => sum + page.itemIds.length, 0),
      0,
    );
  if (visualCount > MOODBOARD_SNAPSHOT_MAX_VISUALS) {
    throw new MoodboardSnapshotError(
      `Select at most ${MOODBOARD_SNAPSHOT_MAX_VISUALS} visuals per snapshot.`,
    );
  }
  const total = snapshotPageCount(sections);
  const generatedOn = preview.generatedAt.slice(0, 10);
  const pages: (SnapshotRenderPage & { fileStem: string })[] =
    await Promise.all(
      sections
        .flatMap((section) =>
          section.pages.map((page, index) => ({ index, page, section })),
        )
        .map(async ({ index, page, section }, pageIndex) => ({
          fileStem: `${slug(moodboard.title)}-${generatedOn}-${slug(section.key)}-${index + 1}`,
          generatedOn,
          moment: preview.moment,
          pageNumber: pageIndex + 1,
          sectionTitle: section.title,
          tiles: await Promise.all(
            page.itemIds.map((id) => tileFor(id, moodboard, dependencies)),
          ),
          totalPages: total,
        })),
    );
  if (input.format === "PNG") {
    const images = await dependencies.renderer.png(pages);
    return {
      files: images.map((image, index) => ({
        base64: Buffer.from(image).toString("base64"),
        fileName: `${pages[index]?.fileStem ?? "snapshot"}.png`,
        mimeType: "image/png" as const,
      })),
      format: "PNG",
      generatedAt: preview.generatedAt,
      preview,
    };
  }
  const pdf = await dependencies.renderer.pdf(pages);
  return {
    files: [
      {
        base64: Buffer.from(pdf).toString("base64"),
        fileName: `${slug(moodboard.title)}-${generatedOn}-snapshot.pdf`,
        mimeType: "application/pdf",
      },
    ],
    format: "PDF",
    generatedAt: preview.generatedAt,
    preview,
  };
}

export function createDatabaseMoodboardSnapshots(
  database: Database,
  options: {
    objectStore?: Pick<FileAttachmentObjectStore, "read">;
    renderer?: SnapshotRenderer;
  } = {},
): MoodboardSnapshotsAccess {
  const moodboards = createDatabaseMoodboards(database);

  async function loadOwnedBytes(
    accountId: string,
    moodboard: Moodboard,
    attachmentVersionId: string,
  ) {
    if (!options.objectStore) {
      return null;
    }
    const [row] = await database
      .select({ objectKey: fileAttachmentVersion.objectKey })
      .from(fileAttachmentVersion)
      .innerJoin(
        fileAttachment,
        eq(fileAttachment.id, fileAttachmentVersion.attachmentId),
      )
      .innerJoin(workspace, eq(workspace.id, fileAttachment.workspaceId))
      .where(
        and(
          eq(fileAttachmentVersion.id, attachmentVersionId),
          eq(fileAttachment.projectId, moodboard.projectId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    try {
      return await options.objectStore.read(row.objectKey);
    } catch {
      return null;
    }
  }

  return {
    async export(
      accountId: string,
      input: MoodboardSnapshotExportInput,
    ): Promise<MoodboardSnapshotOutput | null> {
      const moodboard = await moodboards.get(accountId, input.moodboardId);
      if (!moodboard) {
        return null;
      }
      return buildMoodboardSnapshotOutput(moodboard, input, {
        loadOriginalBytes: (versionId) =>
          loadOwnedBytes(accountId, moodboard, versionId),
        now: () => new Date(),
        renderer: options.renderer ?? playwrightSnapshotRenderer,
      });
    },
    async preview(
      accountId: string,
      input: MoodboardSnapshotPreviewInput,
    ): Promise<MoodboardSnapshotPreview | null> {
      const moodboard = await moodboards.get(accountId, input.moodboardId);
      if (!moodboard) {
        return null;
      }
      return previewMoodboardSnapshot(moodboard, input.itemIds, new Date());
    },
  };
}
