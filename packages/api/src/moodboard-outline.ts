import {
  OUTLINE_UNGROUPED_SECTION,
  OUTLINE_VISUALS_SECTION,
} from "./moodboard-viewport";
import { MOODBOARD_UI_LABELS, type Moodboard } from "./moodboards";

/**
 * Pointer-free structured outline of a Moodboard: the functional equivalent of
 * the canvas for add, select, reorder, group, inspect, and Open Source Record.
 * Everything here is derived from the Moodboard; collapse state is the only
 * view-local input and never changes content.
 */

export interface OutlineItem {
  id: string;
  kind: "Color Swatch" | "Visual";
  label: string;
  sectionKey: string;
}

export interface OutlineSection {
  collapsed: boolean;
  items: OutlineItem[];
  key: string;
  label: string;
}

export type OutlineRow =
  | { kind: "section"; section: OutlineSection }
  | { item: OutlineItem; kind: "item"; sectionKey: string };

export type OutlineSourceTarget =
  | { kind: "attachment"; attachmentVersionId: string }
  | { kind: "link"; url: string };

type MoodboardItem = Moodboard["items"][number];

export function outlineItemLabel(item: MoodboardItem) {
  if (item.kind === "Color Swatch") {
    return item.note
      ? `${MOODBOARD_UI_LABELS.colorSwatch} ${item.color}, ${item.note}`
      : `${MOODBOARD_UI_LABELS.colorSwatch} ${item.color}`;
  }
  const origin =
    item.origin.kind === "External link"
      ? item.origin.url
      : `${MOODBOARD_UI_LABELS.fileAttachmentVersion} ${item.origin.attachmentVersionId}`;
  return item.caption ? `${item.caption} (${origin})` : origin;
}

/** A swatch has no source record; a visual points at its exact origin. */
export function outlineSourceTarget(
  item: MoodboardItem,
): OutlineSourceTarget | null {
  if (item.kind !== "Visual") {
    return null;
  }
  return item.origin.kind === "External link"
    ? { kind: "link", url: item.origin.url }
    : {
        attachmentVersionId: item.origin.attachmentVersionId,
        kind: "attachment",
      };
}

/** Visuals, one section per Palette group, then ungrouped swatches. */
export function buildOutlineSections(
  moodboard: Moodboard,
  collapsed: readonly string[],
): OutlineSection[] {
  const collapsedSet = new Set(collapsed);
  const sections = new Map<string, OutlineSection>();
  const open = (key: string, label: string) => {
    const section: OutlineSection = {
      collapsed: collapsedSet.has(key),
      items: [],
      key,
      label,
    };
    sections.set(key, section);
    return section;
  };
  open(OUTLINE_VISUALS_SECTION, "Visuals");
  for (const group of moodboard.paletteGroups) {
    open(group.id, `${MOODBOARD_UI_LABELS.paletteGroup}: ${group.name}`);
  }
  open(OUTLINE_UNGROUPED_SECTION, MOODBOARD_UI_LABELS.noPaletteGroup);
  for (const item of moodboard.items) {
    const key =
      item.kind === "Visual"
        ? OUTLINE_VISUALS_SECTION
        : (item.paletteGroupId ?? OUTLINE_UNGROUPED_SECTION);
    const section =
      sections.get(key) ?? sections.get(OUTLINE_UNGROUPED_SECTION);
    section?.items.push({
      id: item.id,
      kind: item.kind,
      label: outlineItemLabel(item),
      sectionKey: section?.key ?? OUTLINE_UNGROUPED_SECTION,
    });
  }
  return [...sections.values()].filter(
    (section) =>
      section.items.length > 0 ||
      (section.key !== OUTLINE_VISUALS_SECTION &&
        section.key !== OUTLINE_UNGROUPED_SECTION),
  );
}

/** Flat rows in reading order; collapsed sections keep their header only. */
export function flattenOutline(sections: readonly OutlineSection[]) {
  const rows: OutlineRow[] = [];
  for (const section of sections) {
    rows.push({ kind: "section", section });
    if (!section.collapsed) {
      for (const item of section.items) {
        rows.push({ item, kind: "item", sectionKey: section.key });
      }
    }
  }
  return rows;
}

export type OutlineKey = "ArrowDown" | "ArrowUp" | "End" | "Home";

/** Roving focus for the outline list: arrows move one row, Home/End jump. */
export function nextOutlineIndex(
  count: number,
  current: number,
  key: OutlineKey,
) {
  if (count === 0) {
    return -1;
  }
  switch (key) {
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    default:
      return count - 1;
  }
}

/**
 * `Move up` / `Move down`: swaps the item with its neighbor inside the same
 * section and returns the full new item order, or null at the section edge.
 */
export function moveWithinSection(
  order: readonly string[],
  sectionItemIds: readonly string[],
  itemId: string,
  direction: "down" | "up",
): string[] | null {
  const at = sectionItemIds.indexOf(itemId);
  const neighborId = sectionItemIds[direction === "up" ? at - 1 : at + 1];
  if (at < 0 || neighborId === undefined) {
    return null;
  }
  const from = order.indexOf(itemId);
  const to = order.indexOf(neighborId);
  if (from < 0 || to < 0) {
    return null;
  }
  const next = [...order];
  next[from] = neighborId;
  next[to] = itemId;
  return next;
}

/** Drag or keyboard-sensor drop of `itemId` onto `overId` within one section. */
export function dropWithinSection(
  order: readonly string[],
  sectionItemIds: readonly string[],
  itemId: string,
  overId: string,
): string[] | null {
  if (
    itemId === overId ||
    !sectionItemIds.includes(itemId) ||
    !sectionItemIds.includes(overId)
  ) {
    return null;
  }
  const sectionOrder = sectionItemIds.filter((id) => id !== itemId);
  sectionOrder.splice(sectionItemIds.indexOf(overId), 0, itemId);
  const slots = new Set(sectionItemIds);
  let cursor = 0;
  return order.map((id) => {
    if (!slots.has(id)) {
      return id;
    }
    const replacement = sectionOrder[cursor];
    cursor += 1;
    return replacement ?? id;
  });
}
