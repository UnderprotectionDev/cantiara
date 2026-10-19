import {
  animationBlockRefs,
  parseWireframeDocument,
  resolveBlock,
  sourcePathOf,
  type WireframeAnimation,
  type WireframeBlock,
  type WireframeDocument,
  WireframeDocumentError,
  type WireframeLinkedDefinition,
  type WireframeTextContent,
} from "./wireframe-document";

/**
 * A completed gesture is a command; one gesture is one transaction. Pointer
 * moves and drags never reach this module: the editor commits once at the end.
 */
export const WIREFRAME_ALIGN_EDGES = [
  "left",
  "right",
  "top",
  "bottom",
  "center",
  "middle",
] as const;
export type WireframeAlignEdge = (typeof WIREFRAME_ALIGN_EDGES)[number];

export type WireframeCommand =
  | { block: WireframeBlock; type: "addBlock" }
  | { blockId: string; toIndex: number; type: "reorderBlock" }
  | {
      blockIds: readonly string[];
      edge: WireframeAlignEdge;
      type: "alignBlocks";
    }
  | { blockId: string; type: "removeBlock" }
  | { blockId: string; type: "moveBlock"; x: number; y: number }
  | {
      blockId: string;
      height: number;
      type: "resizeBlock";
      width: number;
      x: number;
      y: number;
    }
  | { blockId: string; label: string; type: "setLabel" }
  | { blockId: string; text: WireframeTextContent; type: "setText" }
  | {
      blockId: string;
      definition: WireframeLinkedDefinition;
      type: "linkBlock";
    }
  | { blockId: string; type: "detachLink" }
  | { definition: WireframeLinkedDefinition; type: "applyLinkedSource" }
  | { animation: WireframeAnimation; type: "addAnimation" }
  | { animationId: string; type: "removeAnimation" };

function indexOfBlock(document: WireframeDocument, blockId: string) {
  const index = document.blocks.findIndex(({ id }) => id === blockId);
  if (index < 0) {
    throw new WireframeDocumentError(
      "BLOCK_NOT_FOUND",
      `Block ${blockId} was not found.`,
    );
  }
  return index;
}

function replaceBlock(
  document: WireframeDocument,
  index: number,
  block: WireframeBlock,
): WireframeDocument {
  return {
    ...document,
    blocks: document.blocks.map((current, at) =>
      at === index ? block : current,
    ),
  };
}

function pruneDefinitions(document: WireframeDocument): WireframeDocument {
  const used = new Set(
    document.blocks.flatMap(({ link }) => (link ? [link.definitionId] : [])),
  );
  return {
    ...document,
    linkedDefinitions: Object.fromEntries(
      Object.entries(document.linkedDefinitions).filter(([id]) => used.has(id)),
    ),
  };
}

function refuseLiveCard(block: WireframeBlock) {
  if (block.kind === "Live Card") {
    throw new WireframeDocumentError(
      "INVALID_COMMAND",
      "A live card is a read-only view of its record. Move it; edit the record at its source.",
    );
  }
}

function refuseLinked(block: WireframeBlock) {
  if (block.link) {
    throw new WireframeDocumentError(
      "LINKED_BLOCK_READ_ONLY",
      "A linked block takes its content from its source. Change the source or Detach Link.",
    );
  }
}

function applyCommand(
  document: WireframeDocument,
  command: WireframeCommand,
): WireframeDocument {
  switch (command.type) {
    case "addBlock":
      return { ...document, blocks: [...document.blocks, command.block] };
    case "removeBlock": {
      indexOfBlock(document, command.blockId);
      return pruneDefinitions({
        ...document,
        animations: document.animations.filter(
          (animation) =>
            !animationBlockRefs(animation).includes(command.blockId),
        ),
        blocks: document.blocks.filter(({ id }) => id !== command.blockId),
      });
    }
    case "reorderBlock": {
      const from = indexOfBlock(document, command.blockId);
      const to = Math.min(
        document.blocks.length - 1,
        Math.max(0, Math.trunc(command.toIndex)),
      );
      const blocks = [...document.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved as WireframeBlock);
      return { ...document, blocks };
    }
    case "alignBlocks": {
      const targets = command.blockIds.map((id) => ({
        block: document.blocks[indexOfBlock(document, id)] as WireframeBlock,
        id,
      }));
      if (targets.length < 2) {
        return document;
      }
      const left = Math.min(...targets.map(({ block }) => block.x));
      const top = Math.min(...targets.map(({ block }) => block.y));
      const right = Math.max(
        ...targets.map(({ block }) => block.x + block.width),
      );
      const bottom = Math.max(
        ...targets.map(({ block }) => block.y + block.height),
      );
      const moved = new Map(
        targets.map(({ block, id }) => {
          const next = { x: block.x, y: block.y };
          switch (command.edge) {
            case "left":
              next.x = left;
              break;
            case "right":
              next.x = right - block.width;
              break;
            case "top":
              next.y = top;
              break;
            case "bottom":
              next.y = bottom - block.height;
              break;
            case "center":
              next.x = (left + right) / 2 - block.width / 2;
              break;
            default:
              next.y = (top + bottom) / 2 - block.height / 2;
          }
          return [id, next] as const;
        }),
      );
      return {
        ...document,
        blocks: document.blocks.map((block) => {
          const next = moved.get(block.id);
          return next ? { ...block, ...next } : block;
        }),
      };
    }
    case "moveBlock": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      return replaceBlock(document, index, {
        ...block,
        x: command.x,
        y: command.y,
      });
    }
    case "resizeBlock": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      refuseLinked(block);
      return replaceBlock(document, index, {
        ...block,
        height: command.height,
        width: command.width,
        x: command.x,
        y: command.y,
      });
    }
    case "setLabel": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      refuseLinked(block);
      refuseLiveCard(block);
      return replaceBlock(document, index, { ...block, label: command.label });
    }
    case "setText": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      if (block.kind !== "Text") {
        throw new WireframeDocumentError(
          "INVALID_COMMAND",
          "Only a text block holds text content.",
        );
      }
      return replaceBlock(document, index, { ...block, text: command.text });
    }
    case "linkBlock": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      if (block.kind !== command.definition.content.kind) {
        throw new WireframeDocumentError(
          "INVALID_COMMAND",
          "A block can only link to a definition of its own kind.",
        );
      }
      return pruneDefinitions({
        ...replaceBlock(document, index, {
          ...block,
          link: { definitionId: command.definition.id },
        }),
        linkedDefinitions: {
          ...document.linkedDefinitions,
          [command.definition.id]: command.definition,
        },
      });
    }
    case "detachLink": {
      const index = indexOfBlock(document, command.blockId);
      const block = document.blocks[index] as WireframeBlock;
      if (!block.link) {
        throw new WireframeDocumentError(
          "NOT_LINKED",
          "Only a linked block can Detach Link.",
        );
      }
      // Freeze the content as it reads now into an independent block.
      const { link: _link, ...frozen } = resolveBlock(document, block);
      return pruneDefinitions(
        replaceBlock(
          document,
          index,
          structuredClone(frozen) as WireframeBlock,
        ),
      );
    }
    case "applyLinkedSource":
      return {
        ...document,
        linkedDefinitions: {
          ...document.linkedDefinitions,
          [command.definition.id]: command.definition,
        },
      };
    case "addAnimation":
      return {
        ...document,
        animations: [...document.animations, command.animation],
      };
    case "removeAnimation":
      return {
        ...document,
        animations: document.animations.filter(
          ({ id }) => id !== command.animationId,
        ),
      };
    default:
      throw new WireframeDocumentError("INVALID_COMMAND", "Unknown command.");
  }
}

/**
 * Applies one transaction atomically. The result is validated against the
 * canonical schema; on any failure the input document is unchanged.
 */
export function applyWireframeTransaction(
  document: WireframeDocument,
  commands: readonly WireframeCommand[],
): WireframeDocument {
  const next = commands.reduce(applyCommand, document);
  return parseWireframeDocument(next);
}

export interface LinkedBlockScreen {
  document: WireframeDocument;
  lifecycle: "Active" | "Archived" | "In Trash";
  screenId: string;
  title: string;
}

export interface AffectedScreen {
  blockIds: string[];
  screenId: string;
  title: string;
}

/**
 * Preview of a source change: the Screens whose Wireframe uses the definition.
 * A Screen in Trash is a broken target and is neither previewed nor changed.
 */
export function previewLinkedSourceChange(
  screens: readonly LinkedBlockScreen[],
  definitionId: string,
): AffectedScreen[] {
  const affected: AffectedScreen[] = [];
  for (const screen of screens) {
    if (screen.lifecycle === "In Trash") {
      continue;
    }
    const blockIds = screen.document.blocks
      .filter(({ link }) => link?.definitionId === definitionId)
      .map(({ id }) => id);
    if (blockIds.length > 0) {
      affected.push({
        blockIds,
        screenId: screen.screenId,
        title: screen.title,
      });
    }
  }
  return affected;
}

export interface LiveTextResolution {
  sourcePath: string;
  /** `broken` keeps the last visible text next to the broken marker. */
  state: "broken" | "resolved";
  text: string;
}

export type LiveSectionLookup = (source: {
  documentId: string;
  sectionId: string;
}) => string | null;

function liveSources(document: WireframeDocument) {
  return document.blocks.flatMap((block) =>
    block.kind === "Text" && block.text.mode === "live"
      ? [{ blockId: block.id, text: block.text }]
      : [],
  );
}

export function liveTextSources(document: WireframeDocument) {
  return liveSources(document).map(({ text }) => text.source);
}

/** Reads live text now. A broken source is reported broken, never as empty text. */
export function resolveLiveText(
  document: WireframeDocument,
  lookup: LiveSectionLookup,
): Record<string, LiveTextResolution> {
  const result: Record<string, LiveTextResolution> = {};
  for (const { blockId, text } of liveSources(document)) {
    const current = lookup(text.source);
    result[blockId] = {
      sourcePath: sourcePathOf(text.source),
      state: current === null ? "broken" : "resolved",
      text: current ?? text.visibleText,
    };
  }
  return result;
}

/**
 * Freezes the then-visible text of live references into the document being
 * saved as a version. A broken source keeps the previously visible text.
 */
export function freezeLiveText(
  document: WireframeDocument,
  lookup: LiveSectionLookup,
): WireframeDocument {
  const resolutions = resolveLiveText(document, lookup);
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      const resolution = resolutions[block.id];
      if (
        block.kind === "Text" &&
        block.text.mode === "live" &&
        resolution?.state === "resolved"
      ) {
        return {
          ...block,
          text: { ...block.text, visibleText: resolution.text },
        };
      }
      return block;
    }),
  };
}
