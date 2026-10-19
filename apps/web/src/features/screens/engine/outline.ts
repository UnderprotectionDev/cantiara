import type { WireframeAlignEdge } from "@cantiara/api/wireframe-commands";
import type {
  WireframeBlock,
  WireframeDocument,
} from "@cantiara/api/wireframe-document";

/** A record a block reads from: `Open Source Record` opens exactly this. */
export type OutlineSourceRecord =
  | { kind: "record"; label: string; recordId: string; recordType: string }
  | { documentId: string; kind: "document"; label: string; sectionId: string };

export interface OutlineGroup {
  /** View-local group id; the collapsed ones are the personal viewport's. */
  id: string;
  items: WireframeBlock[];
}

/** Groups the outline by closed block kind, in first-appearance order. */
export function groupOutline(
  blocks: readonly WireframeBlock[],
): OutlineGroup[] {
  const groups = new Map<string, OutlineGroup>();
  for (const block of blocks) {
    const group = groups.get(block.kind) ?? { id: block.kind, items: [] };
    group.items.push(block);
    groups.set(block.kind, group);
  }
  return [...groups.values()];
}

/** The source record behind a block, or `null` when it reads from nothing. */
export function sourceRecordOf(
  block: WireframeBlock,
): OutlineSourceRecord | null {
  if (block.kind === "Live Card") {
    return {
      kind: "record",
      label: `${block.props.recordType} ${block.props.recordId}`,
      recordId: block.props.recordId,
      recordType: block.props.recordType,
    };
  }
  if (block.kind === "Text" && block.text.mode === "live") {
    return {
      documentId: block.text.source.documentId,
      kind: "document",
      label: `Document section ${block.text.source.sectionId}`,
      sectionId: block.text.source.sectionId,
    };
  }
  return null;
}

/** Plain-language inspector rows for one block; read-only facts. */
export function inspectBlock(
  document: WireframeDocument,
  block: WireframeBlock,
): { label: string; value: string }[] {
  const definition = block.link
    ? document.linkedDefinitions[block.link.definitionId]
    : undefined;
  return [
    { label: "Kind", value: block.kind },
    { label: "Label", value: block.label },
    {
      label: "Position",
      value: `${Math.round(block.x)}, ${Math.round(block.y)}`,
    },
    {
      label: "Size",
      value: `${Math.round(block.width)} x ${Math.round(block.height)}`,
    },
    {
      label: "Linked block",
      value: definition ? `Linked to ${definition.name}` : "Not linked",
    },
  ];
}

/** Key to alignment edge; Alt+Arrow aligns a multi-selection on the canvas. */
export const ALIGN_KEYS: Record<string, WireframeAlignEdge> = {
  ArrowDown: "bottom",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "top",
};

export const ALIGN_LABELS: Record<WireframeAlignEdge, string> = {
  bottom: "Align Bottom",
  center: "Align Center",
  left: "Align Left",
  middle: "Align Middle",
  right: "Align Right",
  top: "Align Top",
};

export const KEYBOARD_MOVE_STEP = 8;
