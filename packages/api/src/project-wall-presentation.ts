import { z } from "zod";

import { snapshotFormatSchema } from "./moodboard-snapshot";
import {
  MOODBOARD_FOCUS_ORDER_MAX,
  presentationSequence,
} from "./moodboard-view";
import type {
  ProjectWallCardView,
  ProjectWallHighlight,
  ProjectWallView,
} from "./project-wall";

const identifierSchema = z.string().trim().min(1).max(255);

export const PROJECT_WALL_PRESENTATION_LABELS = {
  exact: "Exact",
  exitPresentationMode: "Exit Presentation Mode",
  focusOrder: "Focus order",
  frozenCopy: "Frozen copy",
  live: "Live",
  openAllInSource: "Open all in source",
  presentationMode: "Presentation Mode",
  sharedSource: "Shared source",
} as const;

export const PROJECT_WALL_SNAPSHOT_LABELS = {
  frozenCopyNotice:
    "Frozen copy. It is not a share grant and does not widen share scope. It does not lock the Project Wall, live cards keep working, and it is not an External Surface or Build in Public.",
  noLiveLinksNotice:
    "This snapshot carries no live source links. Later changes to the cards or their source records do not update it.",
  pdf: "PDF",
  png: "PNG",
  preview: "Preview",
  snapshot: "Snapshot",
} as const;

/** Cards one snapshot can freeze; larger regions are refused, not truncated. */
export const PROJECT_WALL_SNAPSHOT_CARD_LIMIT = 100;

// --- Focus order -------------------------------------------------------------

export const PROJECT_WALL_FOCUS_ORDER_MAX = MOODBOARD_FOCUS_ORDER_MAX;

/** Unique card ids; an empty list clears the order. It carries no content. */
export const setProjectWallFocusOrderInputSchema = z
  .object({
    cardIds: z
      .array(identifierSchema)
      .max(PROJECT_WALL_FOCUS_ORDER_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "A card can appear once in the Focus order.",
      }),
    projectId: identifierSchema,
    wallId: identifierSchema,
  })
  .strict();
export type SetProjectWallFocusOrderInput = z.input<
  typeof setProjectWallFocusOrderInputSchema
>;

/**
 * `Presentation Mode` steps. With a Focus order the listed cards that still
 * exist come first in that order; without one the wall order is used. The
 * steps are the wall's own cards, so nothing is copied.
 */
export function projectWallPresentationSequence<TCard extends { id: string }>(
  cards: readonly TCard[],
  focusOrder: readonly string[],
): TCard[] {
  return presentationSequence(cards, focusOrder);
}

// --- Snapshot ----------------------------------------------------------------

const snapshotScopeShape = {
  cardIds: z
    .array(identifierSchema)
    .min(1)
    .max(PROJECT_WALL_SNAPSHOT_CARD_LIMIT)
    .optional(),
  groupId: identifierSchema.optional(),
  projectId: identifierSchema,
  wallId: identifierSchema,
};

function hasExactlyOneScope(input: {
  cardIds?: string[] | undefined;
  groupId?: string | undefined;
}) {
  return (input.groupId === undefined) !== (input.cardIds === undefined);
}

const exactlyOneScope = {
  message: "Select either one group or a region of cards.",
  path: ["groupId"],
};

/** A selected group (`groupId`) or region (`cardIds`), never both. */
export const previewProjectWallSnapshotInputSchema = z
  .object(snapshotScopeShape)
  .strict()
  .refine(hasExactlyOneScope, exactlyOneScope);
export type PreviewProjectWallSnapshotInput = z.input<
  typeof previewProjectWallSnapshotInputSchema
>;

export const exportProjectWallSnapshotInputSchema = z
  .object({ ...snapshotScopeShape, format: snapshotFormatSchema })
  .strict()
  .refine(hasExactlyOneScope, exactlyOneScope);
export type ExportProjectWallSnapshotInput = z.input<
  typeof exportProjectWallSnapshotInputSchema
>;

/** One card as frozen at snapshot time: text only, no source id, no path. */
export interface ProjectWallSnapshotCard {
  highlight: ProjectWallHighlight | null;
  kindLabel: string;
  lines: string[];
  title: string;
  x: number;
  y: number;
}

/** A `Visual link` between two frozen cards, by index into `cards`. */
export interface ProjectWallSnapshotLink {
  from: number;
  label: string;
  to: number;
}

/** Everything a renderer draws; it holds no URL, id or live reference. */
export interface ProjectWallSnapshotData {
  cards: ProjectWallSnapshotCard[];
  generatedAt: string;
  generatedOn: string;
  links: ProjectWallSnapshotLink[];
  moment: string;
  scopeLabel: string;
}

export interface ProjectWallSnapshotPreview {
  cardCount: number;
  generatedAt: string;
  linkCount: number;
  moment: string;
  notices: string[];
  scope: "group" | "region";
  scopeLabel: string;
}

export interface ProjectWallSnapshotFile {
  base64: string;
  fileName: string;
  mimeType: "application/pdf" | "image/png";
}

export interface ProjectWallSnapshotOutput {
  files: ProjectWallSnapshotFile[];
  format: z.infer<typeof snapshotFormatSchema>;
  generatedAt: string;
  preview: ProjectWallSnapshotPreview;
}

/** Static renderer: PNG or PDF bytes of one frozen snapshot. */
export interface ProjectWallSnapshotRenderer {
  pdf: (data: ProjectWallSnapshotData) => Promise<Uint8Array>;
  png: (data: ProjectWallSnapshotData) => Promise<Uint8Array>;
}

const SNAPSHOT_NODE_LINES = 6;

/** Text a card freezes: source fields, or the diagram or collection summary. */
export function projectWallSnapshotLines(card: ProjectWallCardView): string[] {
  const { broken } = card.source;
  if (broken && broken.reason !== "Archived") {
    return [`Broken: ${broken.reason}`];
  }
  const lines = [
    ...(broken ? ["Archived"] : []),
    ...card.fields.map((field) => `${field.name}: ${field.value}`),
  ];
  const { preview } = card;
  if (preview?.kind === "Technical Diagram") {
    lines.push(
      `${preview.viewName ?? "Default"} view (${preview.pin === "Exact" ? PROJECT_WALL_PRESENTATION_LABELS.exact : PROJECT_WALL_PRESENTATION_LABELS.live} at snapshot time)`,
      ...preview.nodes
        .slice(0, SNAPSHOT_NODE_LINES)
        .map((node) => `${node.kind}: ${node.label}`),
    );
  }
  if (preview?.kind === "Smart Collection") {
    lines.push(
      `${preview.total} result${preview.total === 1 ? "" : "s"}`,
      ...preview.items.map((item) => `${item.recordType}: ${item.title}`),
    );
  }
  return lines;
}

/**
 * Freezes the selected cards of a live wall view into plain data. Because the
 * result is built from one read and holds no reference back, a later source
 * edit cannot reach it; the live view is untouched.
 */
export function buildProjectWallSnapshotData(
  wall: ProjectWallView,
  cards: readonly ProjectWallCardView[],
  scopeLabel: string,
  now: Date,
): ProjectWallSnapshotData {
  const generatedAt = now.toISOString();
  const index = new Map(cards.map((card, position) => [card.id, position]));
  return {
    cards: cards.map((card) => ({
      highlight: card.highlight,
      kindLabel: card.sourceType,
      lines: projectWallSnapshotLines(card),
      title: card.source.title ?? "Unavailable record",
      x: card.position.x,
      y: card.position.y,
    })),
    generatedAt,
    generatedOn: generatedAt.slice(0, 10),
    links: wall.links.flatMap((link) => {
      const from = index.get(link.fromCardId);
      const to = index.get(link.toCardId);
      return from === undefined || to === undefined
        ? []
        : [{ from, label: link.label, to }];
    }),
    moment: `${wall.title} - ${scopeLabel} as of ${generatedAt.slice(0, 10)}`,
    scopeLabel,
  };
}

export function buildProjectWallSnapshotPreview(
  data: ProjectWallSnapshotData,
  scope: "group" | "region",
): ProjectWallSnapshotPreview {
  return {
    cardCount: data.cards.length,
    generatedAt: data.generatedAt,
    linkCount: data.links.length,
    moment: data.moment,
    notices: [
      PROJECT_WALL_SNAPSHOT_LABELS.noLiveLinksNotice,
      PROJECT_WALL_SNAPSHOT_LABELS.frozenCopyNotice,
    ],
    scope,
    scopeLabel: data.scopeLabel,
  };
}
