import { z } from "zod";

/**
 * Canonical Wireframe document (spec 48, ADR-0022). This is the only durable
 * format of a Wireframe version: a versioned, migration-capable model validated
 * with Zod. Renderer output (`Konva.Stage.toJSON()`) is never a persist format;
 * Konva and Rough.js are adapters that read this geometry and meaning.
 */
export const WIREFRAME_DOCUMENT_FORMAT = "cantiara.wireframe-document" as const;
export const WIREFRAME_DOCUMENT_VERSION = 1;

export const WIREFRAME_COMPONENT_KINDS = [
  "Button",
  "Input",
  "Card",
  "Table",
  "Navigation",
  "Chart",
] as const;
export type WireframeComponentKind = (typeof WIREFRAME_COMPONENT_KINDS)[number];
export const WIREFRAME_BLOCK_KINDS = [
  ...WIREFRAME_COMPONENT_KINDS,
  "Text",
] as const;
export type WireframeBlockKind = (typeof WIREFRAME_BLOCK_KINDS)[number];

/** Closed duration set (milliseconds) for the closed animation set. */
export const WIREFRAME_ANIMATION_DURATIONS_MS = [150, 300, 500, 800] as const;

const identifier = z.string().trim().min(1).max(255);
const coordinate = z.number().finite().min(-100_000).max(100_000);
const dimension = z.number().finite().positive().max(20_000);
const label = z.string().max(500);

const textContentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("placeholder"), text: label }).strict(),
  z
    .object({
      mode: z.literal("live"),
      /** Markdown section reference: a Document and an explicit heading anchor. */
      source: z
        .object({ documentId: identifier, sectionId: identifier })
        .strict(),
      /** The then-visible text, kept so a saved version is not a live alias. */
      visibleText: z.string().max(20_000),
    })
    .strict(),
]);
export type WireframeTextContent = z.infer<typeof textContentSchema>;
export { textContentSchema as wireframeTextContentSchema };

const sized = { height: dimension, label, width: dimension };

const buttonContent = z
  .object({
    ...sized,
    kind: z.literal("Button"),
    props: z.object({ variant: z.enum(["primary", "secondary"]) }).strict(),
  })
  .strict();
const inputContent = z
  .object({
    ...sized,
    kind: z.literal("Input"),
    props: z.object({ placeholder: label }).strict(),
  })
  .strict();
const cardContent = z
  .object({
    ...sized,
    kind: z.literal("Card"),
    props: z.object({ hasHeader: z.boolean() }).strict(),
  })
  .strict();
const tableContent = z
  .object({
    ...sized,
    kind: z.literal("Table"),
    props: z
      .object({
        columns: z.number().int().min(1).max(20),
        rows: z.number().int().min(1).max(50),
      })
      .strict(),
  })
  .strict();
const navigationContent = z
  .object({
    ...sized,
    kind: z.literal("Navigation"),
    props: z
      .object({ items: z.array(z.string().max(80)).min(1).max(12) })
      .strict(),
  })
  .strict();
const chartContent = z
  .object({
    ...sized,
    kind: z.literal("Chart"),
    props: z.object({ chartType: z.enum(["bar", "line", "pie"]) }).strict(),
  })
  .strict();
const textBlockContent = z
  .object({ ...sized, kind: z.literal("Text"), text: textContentSchema })
  .strict();

/**
 * Read-only live Work/Decision/Risk card (Canlı kart). It is a Wireframe-local
 * view of one main record: placement is the only thing the Screen owns, so
 * moving it never writes the source record. It is not a palette component kind
 * and cannot be a linked-block definition.
 */
export const WIREFRAME_LIVE_CARD_KIND = "Live Card" as const;
export const WIREFRAME_LIVE_CARD_RECORD_TYPES = [
  "Work",
  "Decision",
  "Risk",
] as const;
export type WireframeLiveCardRecordType =
  (typeof WIREFRAME_LIVE_CARD_RECORD_TYPES)[number];
const liveCardContent = z
  .object({
    ...sized,
    kind: z.literal(WIREFRAME_LIVE_CARD_KIND),
    props: z
      .object({
        recordId: identifier,
        recordType: z.enum(WIREFRAME_LIVE_CARD_RECORD_TYPES),
      })
      .strict(),
  })
  .strict();

/** What a linked block shares: everything but placement. Text is block-local. */
const linkedContentSchema = z.discriminatedUnion("kind", [
  buttonContent,
  inputContent,
  cardContent,
  tableContent,
  navigationContent,
  chartContent,
]);
export type WireframeLinkedContent = z.infer<typeof linkedContentSchema>;
export { linkedContentSchema as wireframeLinkedContentSchema };

export const wireframeLinkedDefinitionSchema = z
  .object({
    content: linkedContentSchema,
    id: identifier,
    name: z.string().trim().min(1).max(120),
    revision: z.number().int().min(1).safe(),
  })
  .strict();
export type WireframeLinkedDefinition = z.infer<
  typeof wireframeLinkedDefinitionSchema
>;

const placement = {
  id: identifier,
  link: z.object({ definitionId: identifier }).strict().optional(),
  /** Fixed per-item Rough.js seed: rerender and export never jitter. */
  seed: z.number().int().min(0).max(2_147_483_647),
  x: coordinate,
  y: coordinate,
};

export const wireframeBlockSchema = z.discriminatedUnion("kind", [
  buttonContent.extend(placement),
  inputContent.extend(placement),
  cardContent.extend(placement),
  tableContent.extend(placement),
  navigationContent.extend(placement),
  chartContent.extend(placement),
  textBlockContent.extend(placement),
  liveCardContent.extend(placement),
]);
export type WireframeBlock = z.infer<typeof wireframeBlockSchema>;

const duration = z.union([
  z.literal(150),
  z.literal(300),
  z.literal(500),
  z.literal(800),
]);
const blockRef = identifier;

/**
 * The closed animation set. Every variant is strict, so keyframes, custom
 * easing, physics, scroll links and multi-layer choreography cannot be stored.
 */
export const wireframeAnimationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      action: z.enum(["show", "hide"]),
      id: identifier,
      kind: z.literal("show-hide"),
      targetBlockId: blockRef,
      triggerBlockId: blockRef,
    })
    .strict(),
  z
    .object({
      durationMs: duration,
      id: identifier,
      kind: z.literal("two-state"),
      targetBlockId: blockRef,
      toState: z
        .object({
          offsetX: coordinate.default(0),
          offsetY: coordinate.default(0),
          opacity: z.number().min(0).max(1).default(1),
        })
        .strict(),
      triggerBlockId: blockRef,
    })
    .strict(),
  z
    .object({
      effect: z.enum(["highlight", "invert", "shrink"]),
      id: identifier,
      kind: z.literal("hover-press"),
      state: z.enum(["hover", "press"]),
      targetBlockId: blockRef,
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("sequence"),
      steps: z
        .array(
          z
            .object({
              action: z.enum(["show", "hide"]),
              blockId: blockRef,
              durationMs: duration,
            })
            .strict(),
        )
        .min(1)
        .max(20),
      triggerBlockId: blockRef,
    })
    .strict(),
  z
    .object({
      durationMs: duration,
      id: identifier,
      kind: z.literal("screen-transition"),
      /** A Screen id, never retargeted: a missing Screen stays missing. */
      targetScreenId: identifier,
      transition: z.enum(["fade", "slide-left", "slide-right"]),
      triggerBlockId: blockRef,
    })
    .strict(),
]);
export type WireframeAnimation = z.infer<typeof wireframeAnimationSchema>;

export function animationBlockRefs(animation: WireframeAnimation): string[] {
  switch (animation.kind) {
    case "hover-press":
      return [animation.targetBlockId];
    case "sequence":
      return [
        animation.triggerBlockId,
        ...animation.steps.map(({ blockId }) => blockId),
      ];
    case "screen-transition":
      return [animation.triggerBlockId];
    default:
      return [animation.triggerBlockId, animation.targetBlockId];
  }
}

export const wireframeDocumentSchema = z
  .object({
    animations: z.array(wireframeAnimationSchema).max(500),
    blocks: z.array(wireframeBlockSchema).max(2000),
    canvas: z
      .object({
        height: z.number().int().min(100).max(20_000),
        width: z.number().int().min(100).max(20_000),
      })
      .strict(),
    format: z.literal(WIREFRAME_DOCUMENT_FORMAT),
    /** Snapshots of the Project-scoped definitions this version used. */
    linkedDefinitions: z.record(z.string(), wireframeLinkedDefinitionSchema),
    version: z.literal(WIREFRAME_DOCUMENT_VERSION),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    for (const block of document.blocks) {
      if (ids.has(block.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate block id ${block.id}.`,
          path: ["blocks"],
        });
      }
      ids.add(block.id);
      if (block.link) {
        const definition = document.linkedDefinitions[block.link.definitionId];
        if (!definition || definition.content.kind !== block.kind) {
          context.addIssue({
            code: "custom",
            message: `Block ${block.id} links to a missing or mismatched definition.`,
            path: ["blocks"],
          });
        }
      }
    }
    const animationIds = new Set<string>();
    for (const animation of document.animations) {
      if (animationIds.has(animation.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate animation id ${animation.id}.`,
          path: ["animations"],
        });
      }
      animationIds.add(animation.id);
      if (!animationBlockRefs(animation).every((id) => ids.has(id))) {
        context.addIssue({
          code: "custom",
          message: `Animation ${animation.id} names a block that does not exist.`,
          path: ["animations"],
        });
      }
    }
  });

export type WireframeDocument = z.infer<typeof wireframeDocumentSchema>;

export function createEmptyWireframeDocument(): WireframeDocument {
  return {
    animations: [],
    blocks: [],
    canvas: { height: 800, width: 1280 },
    format: WIREFRAME_DOCUMENT_FORMAT,
    linkedDefinitions: {},
    version: WIREFRAME_DOCUMENT_VERSION,
  };
}

export type WireframeDocumentErrorCode =
  | "INVALID_DOCUMENT"
  | "KONVA_JSON_REJECTED"
  | "UNSUPPORTED_VERSION"
  | "BLOCK_NOT_FOUND"
  | "LINKED_BLOCK_READ_ONLY"
  | "NOT_LINKED"
  | "INVALID_COMMAND";

export class WireframeDocumentError extends Error {
  readonly code: WireframeDocumentErrorCode;

  constructor(code: WireframeDocumentErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WireframeDocumentError";
  }
}

const KONVA_CLASS_NAMES = new Set([
  "Stage",
  "Layer",
  "FastLayer",
  "Group",
  "Shape",
  "Rect",
  "Text",
  "Line",
  "Path",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for what `Konva.Stage.toJSON()` (a JSON string or its parsed object) produces. */
export function looksLikeKonvaJson(input: unknown): boolean {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return false;
    }
  }
  return (
    isRecord(value) &&
    typeof value.className === "string" &&
    KONVA_CLASS_NAMES.has(value.className) &&
    (isRecord(value.attrs) || Array.isArray(value.children))
  );
}

export type WireframeMigration = (document: unknown) => unknown;

/**
 * Builds a migrator that upgrades a persisted document, one version at a time,
 * to `current`. A document from a newer product version is refused, not
 * guessed at. `migrations[n]` upgrades version n to n + 1.
 */
export function createWireframeMigrator(options: {
  current: number;
  migrations: Record<number, WireframeMigration>;
}) {
  return function migrate(input: unknown): unknown {
    if (looksLikeKonvaJson(input)) {
      throw new WireframeDocumentError(
        "KONVA_JSON_REJECTED",
        "Konva Stage JSON is not a Wireframe document format.",
      );
    }
    if (!isRecord(input) || typeof input.version !== "number") {
      throw new WireframeDocumentError(
        "INVALID_DOCUMENT",
        "A Wireframe document is a versioned object.",
      );
    }
    let document: Record<string, unknown> = input;
    let { version } = input;
    if (version > options.current || !Number.isInteger(version)) {
      throw new WireframeDocumentError(
        "UNSUPPORTED_VERSION",
        `Wireframe document version ${version} is not supported.`,
      );
    }
    while (version < options.current) {
      const step = options.migrations[version];
      if (!step) {
        throw new WireframeDocumentError(
          "UNSUPPORTED_VERSION",
          `No migration from Wireframe document version ${version}.`,
        );
      }
      const next = step(document);
      if (!isRecord(next)) {
        throw new WireframeDocumentError(
          "INVALID_DOCUMENT",
          "A migration must return a document object.",
        );
      }
      document = { ...next, version: version + 1 };
      version += 1;
    }
    return document;
  };
}

/** Version 1 is the first persisted version; later versions add steps here. */
export const migrateWireframeDocument = createWireframeMigrator({
  current: WIREFRAME_DOCUMENT_VERSION,
  migrations: {},
});

/** Migrates and validates a persisted value into the canonical document. */
export function parseWireframeDocument(input: unknown): WireframeDocument {
  const migrated = migrateWireframeDocument(input);
  const result = wireframeDocumentSchema.safeParse(migrated);
  if (!result.success) {
    throw new WireframeDocumentError(
      "INVALID_DOCUMENT",
      result.error.issues[0]?.message ?? "Wireframe document is invalid.",
    );
  }
  return result.data;
}

/** Oriented, canonical bounds used for hit-test, snap, selection and export. */
export interface WireframeBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function blockBounds(block: WireframeBlock): WireframeBounds {
  return { height: block.height, width: block.width, x: block.x, y: block.y };
}

/**
 * Block with its linked definition applied. A linked instance owns only its
 * position and seed; label, size and props come from the shared definition.
 */
export function resolveBlock(
  document: WireframeDocument,
  block: WireframeBlock,
): WireframeBlock {
  const definition = block.link
    ? document.linkedDefinitions[block.link.definitionId]
    : undefined;
  if (!(block.link && definition)) {
    return block;
  }
  return {
    ...definition.content,
    id: block.id,
    link: block.link,
    seed: block.seed,
    x: block.x,
    y: block.y,
  } as WireframeBlock;
}

export function resolvedBlocks(document: WireframeDocument): WireframeBlock[] {
  return document.blocks.map((block) => resolveBlock(document, block));
}

/** Stable per-item seed derived from the block id (31-bit rolling hash). */
export function seedFromId(id: string): number {
  let hash = 7;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 2_147_483_647;
  }
  return hash;
}

/** A newly placed live card; its text is read live, never copied into the document. */
export function createLiveCardBlock(
  id: string,
  at: { x: number; y: number },
  record: { recordId: string; recordType: WireframeLiveCardRecordType },
): WireframeBlock {
  return {
    height: 96,
    id,
    kind: WIREFRAME_LIVE_CARD_KIND,
    label: record.recordType,
    props: record,
    seed: seedFromId(id),
    width: 280,
    x: at.x,
    y: at.y,
  };
}

const DEFAULT_SIZES: Record<
  WireframeBlockKind,
  { height: number; width: number }
> = {
  Button: { height: 44, width: 140 },
  Card: { height: 180, width: 280 },
  Chart: { height: 200, width: 320 },
  Input: { height: 44, width: 260 },
  Navigation: { height: 56, width: 560 },
  Table: { height: 200, width: 420 },
  Text: { height: 40, width: 260 },
};

/** A newly placed block of a closed kind, with its meaning and a fixed seed. */
export function createWireframeBlock(
  kind: WireframeBlockKind,
  id: string,
  at: { x: number; y: number },
): WireframeBlock {
  const base = {
    ...DEFAULT_SIZES[kind],
    id,
    seed: seedFromId(id),
    x: at.x,
    y: at.y,
  };
  switch (kind) {
    case "Button":
      return { ...base, kind, label: "Button", props: { variant: "primary" } };
    case "Input":
      return {
        ...base,
        kind,
        label: "Input",
        props: { placeholder: "Placeholder" },
      };
    case "Card":
      return { ...base, kind, label: "Card", props: { hasHeader: true } };
    case "Table":
      return {
        ...base,
        kind,
        label: "Table",
        props: { columns: 3, rows: 4 },
      };
    case "Navigation":
      return {
        ...base,
        kind,
        label: "Navigation",
        props: { items: ["Home", "Pricing", "Docs"] },
      };
    case "Chart":
      return { ...base, kind, label: "Chart", props: { chartType: "bar" } };
    default:
      return {
        ...base,
        kind: "Text",
        label: "Text",
        text: { mode: "placeholder", text: "Text" },
      };
  }
}

/** Shows how a block's canonical geometry reads on another surface. */
export function sourcePathOf(source: {
  documentId: string;
  sectionId: string;
}) {
  return `/documents/${source.documentId}#${source.sectionId}`;
}
