import { z } from "zod";
import {
  isDefaultVisualView,
  MOODBOARD_FOCUS_ORDER_MAX,
  type VisualView,
} from "./moodboard-view";
import type { Moodboard, MoodboardItem } from "./moodboards";

export const MOODBOARD_SNAPSHOT_LABELS = {
  frozenCopyNotice:
    "Static output. It is not a public share, an External Surface, or an Approved Snapshot Revision, and it is not a live brand guide.",
  noLiveLinksNotice:
    "This snapshot carries no live source links. Later changes to the Moodboard or its files do not update it.",
  externalLinkNotice:
    "Visuals that come from an external link are not embedded; they appear as placeholders and their Crop or Rotate 90° is not applied.",
  noTransformNotice:
    "No view-local Crop or Rotate 90° applies to the selected visuals.",
  pdf: "PDF",
  png: "PNG",
  preview: "Preview",
  snapshot: "Snapshot",
} as const;

/** Visuals per PDF page / PNG image; larger sections continue on the next page. */
export const SNAPSHOT_VISUALS_PER_PAGE = 6;
export const SNAPSHOT_SWATCHES_PER_PAGE = 12;

export const snapshotFormatSchema = z.enum(["PNG", "PDF"]);
export type SnapshotFormat = z.infer<typeof snapshotFormatSchema>;

const snapshotScopeFields = {
  itemIds: z
    .array(z.string().trim().min(1).max(255))
    .min(1, "Select at least one item.")
    .max(MOODBOARD_FOCUS_ORDER_MAX),
  moodboardId: z.string().trim().min(1).max(255),
};

export const moodboardSnapshotPreviewInputSchema = z
  .object(snapshotScopeFields)
  .strict();

export const moodboardSnapshotExportInputSchema = z
  .object({ ...snapshotScopeFields, format: snapshotFormatSchema })
  .strict();

export type MoodboardSnapshotPreviewInput = z.output<
  typeof moodboardSnapshotPreviewInputSchema
>;
export type MoodboardSnapshotExportInput = z.output<
  typeof moodboardSnapshotExportInputSchema
>;

export interface SnapshotPage {
  itemIds: string[];
}

export interface SnapshotSection {
  /** `visuals`, `palette:<groupId>`, or `palette:none`. */
  key: string;
  pages: SnapshotPage[];
  title: string;
}

function chunk<TValue>(values: readonly TValue[], size: number) {
  const pages: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) {
    pages.push(values.slice(index, index + size));
  }
  return pages;
}

/**
 * Splits a selected region into readable sections: the selected visuals, then
 * one section per Palette group, then ungrouped swatches. Every section becomes
 * its own PNG image or its own PDF page(s); the whole board is never one page.
 * The selection is limited to items that exist on the Moodboard, in board order.
 */
export function planSnapshot(
  moodboard: Pick<Moodboard, "items" | "paletteGroups">,
  itemIds: readonly string[],
): SnapshotSection[] {
  const selected = new Set(itemIds);
  const items = moodboard.items.filter(({ id }) => selected.has(id));
  const sections: SnapshotSection[] = [];
  const visuals = items.filter(({ kind }) => kind === "Visual");
  if (visuals.length > 0) {
    sections.push({
      key: "visuals",
      pages: chunk(
        visuals.map(({ id }) => id),
        SNAPSHOT_VISUALS_PER_PAGE,
      ).map((ids) => ({ itemIds: ids })),
      title: "Visuals",
    });
  }
  const swatches = items.filter(
    (item): item is Extract<MoodboardItem, { kind: "Color Swatch" }> =>
      item.kind === "Color Swatch",
  );
  for (const group of [
    ...moodboard.paletteGroups.map(({ id, name }) => ({ id, name })),
    { id: null, name: "No Palette group" },
  ]) {
    const members = swatches.filter(
      ({ paletteGroupId }) => paletteGroupId === group.id,
    );
    if (members.length > 0) {
      sections.push({
        key: `palette:${group.id ?? "none"}`,
        pages: chunk(
          members.map(({ id }) => id),
          SNAPSHOT_SWATCHES_PER_PAGE,
        ).map((ids) => ({ itemIds: ids })),
        title: `Palette group: ${group.name}`,
      });
    }
  }
  return sections;
}

export function snapshotPageCount(sections: readonly SnapshotSection[]) {
  return sections.reduce((total, { pages }) => total + pages.length, 0);
}

export interface SnapshotTransformNotice {
  caption: string | null;
  itemId: string;
  view: VisualView;
}

export const moodboardSnapshotPreviewSchema = z
  .object({
    generatedAt: z.string().datetime(),
    moment: z.string().min(1),
    moodboardId: z.string().min(1),
    notices: z.array(z.string().min(1)),
    pageCount: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    sections: z.array(
      z
        .object({
          itemCount: z.number().int().positive(),
          key: z.string().min(1),
          pageCount: z.number().int().positive(),
          title: z.string().min(1),
        })
        .strict(),
    ),
    transforms: z.array(
      z
        .object({
          caption: z.string().nullable(),
          crop: z.boolean(),
          itemId: z.string().min(1),
          rotation: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

export type MoodboardSnapshotPreview = z.infer<
  typeof moodboardSnapshotPreviewSchema
>;

/**
 * Scope preview: states that the output has no live source links, which
 * Moodboard moment it represents, and which view-local Crop / Rotate 90° it
 * applies. It reads the Moodboard only.
 */
export function buildSnapshotPreview(
  moodboard: Moodboard,
  itemIds: readonly string[],
  now: Date,
): MoodboardSnapshotPreview {
  const sections = planSnapshot(moodboard, itemIds);
  const selected = new Set(
    sections.flatMap(({ pages }) => pages.flatMap((page) => page.itemIds)),
  );
  const transforms = moodboard.items.flatMap((item) =>
    item.kind === "Visual" &&
    selected.has(item.id) &&
    !isDefaultVisualView(item.view)
      ? [
          {
            caption: item.caption,
            crop: item.view.crop !== null,
            itemId: item.id,
            rotation: item.view.rotation,
          },
        ]
      : [],
  );
  const hasExternalLink = moodboard.items.some(
    (item) =>
      item.kind === "Visual" &&
      selected.has(item.id) &&
      item.origin.kind === "External link",
  );
  const generatedAt = now.toISOString();
  return {
    generatedAt,
    moment: `${moodboard.title} as of ${generatedAt.slice(0, 10)}, revision ${moodboard.revision}`,
    moodboardId: moodboard.id,
    notices: [
      MOODBOARD_SNAPSHOT_LABELS.noLiveLinksNotice,
      transforms.length > 0
        ? `View-local Crop or Rotate 90° applies to ${transforms.length} visual${transforms.length === 1 ? "" : "s"}; the original files stay unchanged and downloadable.`
        : MOODBOARD_SNAPSHOT_LABELS.noTransformNotice,
      ...(hasExternalLink
        ? [MOODBOARD_SNAPSHOT_LABELS.externalLinkNotice]
        : []),
      MOODBOARD_SNAPSHOT_LABELS.frozenCopyNotice,
    ],
    pageCount: snapshotPageCount(sections),
    revision: moodboard.revision,
    sections: sections.map(({ key, pages, title }) => ({
      itemCount: pages.reduce((total, page) => total + page.itemIds.length, 0),
      key,
      pageCount: pages.length,
      title,
    })),
    transforms,
  };
}

export interface MoodboardSnapshotFile {
  base64: string;
  fileName: string;
  mimeType: "application/pdf" | "image/png";
}

export interface MoodboardSnapshotOutput {
  files: MoodboardSnapshotFile[];
  format: SnapshotFormat;
  generatedAt: string;
  preview: MoodboardSnapshotPreview;
}

export class MoodboardSnapshotError extends Error {
  readonly code = "MOODBOARD_SNAPSHOT_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "MoodboardSnapshotError";
  }
}

export interface MoodboardSnapshotsAccess {
  export: (
    accountId: string,
    input: MoodboardSnapshotExportInput,
  ) => Promise<MoodboardSnapshotOutput | null>;
  preview: (
    accountId: string,
    input: MoodboardSnapshotPreviewInput,
  ) => Promise<MoodboardSnapshotPreview | null>;
}
