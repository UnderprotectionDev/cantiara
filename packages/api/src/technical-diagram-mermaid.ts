/**
 * Mermaid conversion rules (spec 59 #424). `Convert to Technical Diagram` is an
 * explicit action that mints a new `Imported Independent Copy`; the Mermaid
 * block is parse input only, never an equal authority or a sync source. The
 * block is kept unless the founder chose the live reference in the preview.
 */
export const MERMAID_CONVERT_LABELS = {
  action: "Convert to Technical Diagram",
  keep: "Keep independent",
  replace: "Replace with live reference",
} as const;

export type MermaidBlockOutcome =
  | "Keep independent"
  | "Replace with live reference";

export interface MermaidConversionLostLine {
  line: number;
  reason: string;
  text: string;
}

export interface MermaidConversionSource {
  blockEnd: number;
  /** 1-based line of the opening fence in the Document body. */
  blockLine: number;
  blockStart: number;
  documentId: string;
  documentRevision: number;
  documentTitle: string;
}

export interface MermaidConversionEffects {
  /** Plain statement of what happens to the original block on confirm. */
  blockEffect: string;
  /** Document revision after confirm; equals the source revision when kept. */
  documentRevisionAfter: number;
  lostLines: MermaidConversionLostLine[];
  originRelation: string;
  /** Always false: no live round-trip between block and diagram exists. */
  roundTripSync: false;
}

const fenceOpening = /^ {0,3}(`{3,}|~{3,})mermaid[ \t]*$/;

/** Mermaid source of one exact fenced block, or null when it is not one. */
export function mermaidBlockSource(block: string): string | null {
  const lines = block.replaceAll("\r\n", "\n").split("\n");
  const opening = fenceOpening.exec(lines[0] ?? "");
  if (!opening || lines.length < 3) {
    return null;
  }
  const [, fence] = opening;
  const closing = lines.at(-1)?.trim() ?? "";
  if (
    !fence ||
    closing.length < fence.length ||
    ![...closing].every((character) => character === fence[0])
  ) {
    return null;
  }
  return lines.slice(1, -1).join("\n");
}

export function liveDiagramReference(diagramId: string) {
  return `:::live-diagram{diagramId="${diagramId}"}`;
}

/** The Document body after the chosen block outcome. */
export function applyMermaidBlockOutcome(
  body: string,
  range: { blockStart: number; blockEnd: number },
  outcome: MermaidBlockOutcome,
  diagramId: string,
): string {
  if (outcome === MERMAID_CONVERT_LABELS.keep) {
    return body;
  }
  return (
    body.slice(0, range.blockStart) +
    liveDiagramReference(diagramId) +
    body.slice(range.blockEnd)
  );
}

/** What the preview must show before the one atomic confirmation. */
export function describeMermaidConversion(
  source: MermaidConversionSource,
  outcome: MermaidBlockOutcome,
  lostLines: MermaidConversionLostLine[],
): MermaidConversionEffects {
  const replaced = outcome === MERMAID_CONVERT_LABELS.replace;
  return {
    blockEffect: replaced
      ? `The block becomes a live Technical Diagram reference; ${source.documentTitle} moves to version ${source.documentRevision + 1}.`
      : "The block stays independent Mermaid content; it is not deleted and does not follow the diagram.",
    documentRevisionAfter: source.documentRevision + (replaced ? 1 : 0),
    lostLines,
    originRelation: `Originates from ${source.documentTitle}, version ${source.documentRevision}, line ${source.blockLine}`,
    roundTripSync: false,
  };
}

/** 1-based line number of a body offset. */
export function lineOfOffset(body: string, offset: number) {
  return body.slice(0, offset).split("\n").length;
}
