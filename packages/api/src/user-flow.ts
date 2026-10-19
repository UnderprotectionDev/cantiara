import type {
  UserFlowDocument,
  UserFlowTemplateStructure,
} from "@cantiara/db/schema/user-flow";
import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import type { BrokenReferenceView } from "./relations";
import { workTypeSchema } from "./work-lifecycle";

const identifierSchema = z.string().trim().min(1).max(255);
const versionSchema = z.number().int().min(1).safe();

/**
 * Closed semantic set of a User Flow node. Colour and shape are never a second
 * type system, and Technical Sequence kinds are not part of it.
 */
export const USER_FLOW_NODE_KINDS = [
  "Screen",
  "Action",
  "Decision",
  "State/Outcome",
  "Section",
] as const;
export const userFlowNodeKindSchema = z.enum(USER_FLOW_NODE_KINDS);
export type UserFlowNodeKind = z.infer<typeof userFlowNodeKindSchema>;

/**
 * Limited accessible visual style of a node: a fixed palette tone. The tone is
 * decoration only; `kind` is the single type system, so a tone never changes
 * what a node means, how it is searched, counted or exported.
 */
export const USER_FLOW_NODE_TONES = [
  "default",
  "blue",
  "green",
  "amber",
  "red",
  "violet",
] as const;
export const userFlowNodeToneSchema = z.enum(USER_FLOW_NODE_TONES);
export type UserFlowNodeTone = z.infer<typeof userFlowNodeToneSchema>;

/** Hard performance scene of the editor; a document never exceeds it. */
export const USER_FLOW_NODE_LIMIT = 500;
export const USER_FLOW_LINK_LIMIT = 750;
/**
 * The 500 in "500 visible / 750 link" counts every visible item: nodes plus
 * live cards. A document with 500 nodes therefore has no room for a card.
 */
export const USER_FLOW_VISIBLE_ITEM_LIMIT = USER_FLOW_NODE_LIMIT;

/** Fixed card footprint the canvas renders; viewport meaning is computed from it. */
export const USER_FLOW_NODE_WIDTH = 220;
export const USER_FLOW_NODE_HEIGHT = 96;

export const userFlowTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(255, "Title must be 255 characters or fewer.");

const nodeTextSchema = z
  .string()
  .max(5000, "Node text must be 5000 characters or fewer.");

const positionSchema = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();

const nodeFields = {
  kind: userFlowNodeKindSchema,
  position: positionSchema.default({ x: 0, y: 0 }),
  style: userFlowNodeToneSchema.default("default"),
  /** The only Screen data a node holds: the live reference. Never a copy. */
  screenId: identifierSchema.nullable().default(null),
  /** Section node this node is grouped under; a grouping, never a Screen link. */
  sectionId: identifierSchema.nullable().default(null),
  text: nodeTextSchema.default(""),
};

function requireScreenOnlyForScreenNodes(
  node: { kind: UserFlowNodeKind; screenId: string | null },
  context: z.RefinementCtx,
) {
  if (node.kind === "Screen" && node.screenId === null) {
    context.addIssue({
      code: "custom",
      message: "A Screen node requires a Screen id.",
      path: ["screenId"],
    });
  }
  if (node.kind !== "Screen" && node.screenId !== null) {
    context.addIssue({
      code: "custom",
      message: "Only a Screen node can reference a Screen.",
      path: ["screenId"],
    });
  }
}

export const userFlowNodeInputSchema = z
  .object({ id: identifierSchema, ...nodeFields })
  .strict()
  .superRefine(requireScreenOnlyForScreenNodes);

/**
 * Node of a saved document. A Screen node of a template instance is an
 * unlinked placeholder until the founder links a Screen explicitly, so the
 * document shape allows `screenId: null` on a Screen node; the seam accepts it
 * only for a placeholder that already exists in the previous version.
 */
const userFlowDocumentNodeInputSchema = z
  .object({ id: identifierSchema, ...nodeFields })
  .strict()
  .superRefine((node, context) => {
    if (node.kind !== "Screen" && node.screenId !== null) {
      context.addIssue({
        code: "custom",
        message: "Only a Screen node can reference a Screen.",
        path: ["screenId"],
      });
    }
  });

export const USER_FLOW_CARD_KINDS = ["Work", "Decision", "Risk"] as const;
export const userFlowCardKindSchema = z.enum(USER_FLOW_CARD_KINDS);
export type UserFlowCardKind = z.infer<typeof userFlowCardKindSchema>;
export const USER_FLOW_CARD_LIMIT = 100;

export const userFlowCardInputSchema = z
  .object({
    id: identifierSchema,
    kind: userFlowCardKindSchema,
    position: positionSchema.default({ x: 0, y: 0 }),
    /** The only record data a card holds: the live reference. Never a copy. */
    recordId: identifierSchema,
  })
  .strict();

export const userFlowLinkInputSchema = z
  .object({
    from: identifierSchema,
    id: identifierSchema,
    text: z.string().max(500).default(""),
    to: identifierSchema,
  })
  .strict();

export const userFlowDocumentInputSchema = z
  .object({
    /** Omitted keeps the cards of the previous version. */
    cards: z
      .array(userFlowCardInputSchema)
      .max(USER_FLOW_CARD_LIMIT)
      .optional(),
    links: z.array(userFlowLinkInputSchema).max(USER_FLOW_LINK_LIMIT),
    nodes: z.array(userFlowDocumentNodeInputSchema).max(USER_FLOW_NODE_LIMIT),
  })
  .strict()
  .superRefine((document, context) => {
    const nodeIds = new Set(document.nodes.map(({ id }) => id));
    if (nodeIds.size !== document.nodes.length) {
      context.addIssue({ code: "custom", message: "Duplicate node id." });
    }
    if (
      new Set((document.cards ?? []).map(({ id }) => id)).size !==
      (document.cards ?? []).length
    ) {
      context.addIssue({ code: "custom", message: "Duplicate card id." });
    }
    if (
      new Set(document.links.map(({ id }) => id)).size !== document.links.length
    ) {
      context.addIssue({ code: "custom", message: "Duplicate link id." });
    }
    const visibleItems = document.nodes.length + (document.cards ?? []).length;
    if (visibleItems > USER_FLOW_VISIBLE_ITEM_LIMIT) {
      context.addIssue({
        code: "custom",
        message: `A User Flow shows at most ${USER_FLOW_VISIBLE_ITEM_LIMIT} items (nodes and live cards).`,
      });
    }
    const kinds = new Map(document.nodes.map(({ id, kind }) => [id, kind]));
    for (const node of document.nodes) {
      if (node.sectionId === null) {
        continue;
      }
      if (kinds.get(node.sectionId) !== "Section" || node.kind === "Section") {
        context.addIssue({
          code: "custom",
          message: "Only a non-Section node can be grouped under a Section.",
          path: ["nodes"],
        });
      }
    }
    for (const link of document.links) {
      if (!(nodeIds.has(link.from) && nodeIds.has(link.to))) {
        context.addIssue({
          code: "custom",
          message: "A link must join two nodes of this User Flow.",
        });
      }
    }
  });

export type UserFlowDocumentInput = z.input<typeof userFlowDocumentInputSchema>;
export type ParsedUserFlowDocumentInput = z.output<
  typeof userFlowDocumentInputSchema
>;

export const userFlowProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const userFlowInputSchema = z
  .object({ projectId: identifierSchema, userFlowId: identifierSchema })
  .strict();

export const createUserFlowInputSchema = z
  .object({
    id: identifierSchema.optional(),
    projectId: identifierSchema,
    title: userFlowTitleSchema,
  })
  .strict();

export type CreateUserFlowInput = z.input<typeof createUserFlowInputSchema>;

export const saveUserFlowVersionInputSchema = z
  .object({
    document: userFlowDocumentInputSchema,
    expectedVersion: versionSchema,
    projectId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type SaveUserFlowVersionInput = z.input<
  typeof saveUserFlowVersionInputSchema
>;

/** `Place node`: kind defaults to `Action`, so a node lands without a Screen. */
export const placeUserFlowNodeInputSchema = z
  .object({
    expectedVersion: versionSchema,
    nodeId: identifierSchema.optional(),
    projectId: identifierSchema,
    userFlowId: identifierSchema,
    ...nodeFields,
    kind: userFlowNodeKindSchema.default("Action"),
  })
  .strict()
  .superRefine(requireScreenOnlyForScreenNodes);

export type PlaceUserFlowNodeInput = z.input<
  typeof placeUserFlowNodeInputSchema
>;

export type { UserFlowDocument } from "@cantiara/db/schema/user-flow";

/** Durable record: master row plus the current version's document. */
export interface UserFlowRecord {
  createdAt: string;
  document: UserFlowDocument;
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  version: number;
}

export interface UserFlowSummary {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  version: number;
}

export interface ScreenOption {
  id: string;
  title: string;
}

/** What the owning store can say about a Screen id; absence means permanently deleted. */
export type ScreenLookup =
  | {
      archivedAt: string | null;
      kind: "found";
      projectId: string;
      redactedAt: string | null;
      title: string;
      trashedAt: string | null;
    }
  | { kind: "inaccessible" };

/**
 * Common broken-reference presentation of a node's live Screen reference.
 * `broken` is null only while the Screen resolves. A title appears only while
 * the Screen resolves or is `Archived`; the node never keeps a copy.
 */
export interface ScreenReferenceView {
  broken: BrokenReferenceView | null;
  /** Relative app path of the Screen source; null when it cannot be opened. */
  openPath: string | null;
  screenId: string;
  title: string | null;
}

export interface UserFlowNodeView {
  id: string;
  kind: UserFlowNodeKind;
  placedAt: string;
  position: { x: number; y: number };
  screen: ScreenReferenceView | null;
  /** Section node this node is grouped under, or null. */
  sectionId: string | null;
  style: UserFlowNodeTone;
  text: string;
}

export interface UserFlowView {
  /** Read-only live cards; moving or removing one never writes the source. */
  cards: UserFlowCardView[];
  createdAt: string;
  id: string;
  links: UserFlowDocument["links"];
  nodes: UserFlowNodeView[];
  projectId: string;
  title: string;
  updatedAt: string;
  version: number;
}

export function screenSourcePath(projectId: string, screenId: string) {
  return `/projects/${projectId}#screen-${screenId}`;
}

/**
 * Resolves one live Screen reference. It only ever answers for the node's own
 * Screen id: a missing, foreign or cross-Project Screen never falls back to
 * another Screen, and a broken target never carries a body or a title.
 */
export function resolveScreenReference(input: {
  flowProjectId: string;
  lookup: ScreenLookup | undefined;
  placedAt: string;
  screenId: string;
}): ScreenReferenceView {
  const { flowProjectId, lookup, placedAt, screenId } = input;
  const broken = (
    reason: BrokenReferenceView["reason"],
    canOpenSourceRecord: boolean,
  ): ScreenReferenceView => ({
    broken: { canOpenSourceRecord, establishedAt: placedAt, reason },
    openPath: canOpenSourceRecord
      ? screenSourcePath(flowProjectId, screenId)
      : null,
    screenId,
    title: null,
  });
  if (!lookup) {
    return broken("Permanently deleted", false);
  }
  if (lookup.kind === "inaccessible" || lookup.projectId !== flowProjectId) {
    return broken("No access", false);
  }
  if (lookup.redactedAt) {
    return broken("Redacted for security", false);
  }
  if (lookup.trashedAt) {
    return broken("In Trash", true);
  }
  const openPath = screenSourcePath(flowProjectId, screenId);
  if (lookup.archivedAt) {
    return {
      broken: {
        canOpenSourceRecord: true,
        establishedAt: placedAt,
        reason: "Archived",
      },
      openPath,
      screenId,
      title: lookup.title,
    };
  }
  return { broken: null, openPath, screenId, title: lookup.title };
}

export function buildUserFlowView(
  record: UserFlowRecord,
  lookups: ReadonlyMap<string, ScreenLookup>,
  recordLookups: ReadonlyMap<string, RecordLookup> = new Map(),
): UserFlowView {
  return {
    cards: (record.document.cards ?? []).map((card) => ({
      id: card.id,
      placedAt: card.placedAt,
      position: card.position,
      record: resolveRecordReference({
        flowProjectId: record.projectId,
        kind: card.kind,
        lookup: recordLookups.get(recordLookupKey(card.kind, card.recordId)),
        placedAt: card.placedAt,
        recordId: card.recordId,
      }),
    })),
    createdAt: record.createdAt,
    id: record.id,
    links: record.document.links,
    nodes: record.document.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      placedAt: node.placedAt,
      position: node.position,
      screen: node.screenId
        ? resolveScreenReference({
            flowProjectId: record.projectId,
            lookup: lookups.get(node.screenId),
            placedAt: node.placedAt,
            screenId: node.screenId,
          })
        : null,
      sectionId: node.sectionId ?? null,
      style: node.style ?? "default",
      text: node.text,
    })),
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

function resolvedScreen(node: UserFlowNodeView) {
  return node.screen && node.screen.broken === null ? node.screen : null;
}

/**
 * Text that search indexes for this User Flow. A broken Screen target
 * contributes nothing; node-local text is the flow's own content and stays.
 */
export function userFlowSearchableText(view: UserFlowView): string[] {
  return [
    view.title,
    ...view.nodes.flatMap((node) => {
      const screen = resolvedScreen(node);
      return [node.text, screen?.title ?? ""].filter((text) => text !== "");
    }),
  ];
}

/** Computed counts for Smart Collections and summaries; broken targets are not counted. */
export function userFlowCounts(view: UserFlowView) {
  return {
    links: view.links.length,
    nodes: view.nodes.length,
    screens: view.nodes.filter((node) => resolvedScreen(node)).length,
  };
}

/** Export content; a broken Screen target exports neither its id, title nor body. */
export function userFlowExportContent(view: UserFlowView) {
  return {
    links: view.links,
    nodes: view.nodes.map((node) => {
      const screen = resolvedScreen(node);
      return {
        id: node.id,
        kind: node.kind,
        position: node.position,
        screen: screen ? { id: screen.screenId, title: screen.title } : null,
        text: node.text,
      };
    }),
    title: view.title,
  };
}

export interface UserFlowStore {
  /** Appends the next version; `null` when the User Flow is unavailable. */
  appendVersion: (
    accountId: string,
    input: {
      document: UserFlowDocument;
      expectedVersion: number;
      projectId: string;
      userFlowId: string;
    },
  ) => Promise<UserFlowRecord | null>;
  /**
   * Atomic `Convert and Bind`: exactly one Work, Decision, Risk or Open
   * Question plus its bind. It never creates a Screen. `null` when the User
   * Flow is unavailable.
   */
  convertNode: (
    accountId: string,
    input: ParsedConvertUserFlowNodeInput,
  ) => Promise<UserFlowBindRecord | null>;
  /** Creates version 1; `null` when the Project is unavailable. */
  create: (
    accountId: string,
    input: {
      document: UserFlowDocument;
      id: string;
      projectId: string;
      title: string;
    },
  ) => Promise<UserFlowRecord | null>;
  /** Creates one minimal Screen master; `null` when the Project is unavailable. */
  createScreen: (
    accountId: string,
    input: { id: string; projectId: string; title: string },
  ) => Promise<ScreenOption | null>;
  /** Saves a custom template for the Workspace of the Project; `null` when unavailable. */
  createTemplate: (
    accountId: string,
    input: {
      id: string;
      name: string;
      projectId: string;
      structure: UserFlowTemplateStructure;
    },
  ) => Promise<UserFlowTemplateView | null>;
  find: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowRecord | null>;
  /** Template of the Workspace that owns the Project; `null` when unavailable. */
  findTemplate: (
    accountId: string,
    projectId: string,
    templateId: string,
  ) => Promise<UserFlowTemplateView | null>;
  /** Read-only document of one saved version; `null` when it does not exist. */
  findVersion: (
    accountId: string,
    projectId: string,
    userFlowId: string,
    version: number,
  ) => Promise<UserFlowDocument | null>;
  /**
   * The account's personal viewport of one User Flow canvas, or `null` when
   * none was saved. It lives outside every version, relation and snapshot.
   */
  findViewport: (
    accountId: string,
    userFlowId: string,
  ) => Promise<UserFlowViewport | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<UserFlowRecord[] | null>;
  /** Binds of one User Flow; `null` when the User Flow is unavailable. */
  listBinds: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowBindRecord[] | null>;
  /** Work, Decision and Risk a live card can show; `null` when the Project is unavailable. */
  listCardRecords: (
    accountId: string,
    projectId: string,
  ) => Promise<CardRecordOption[] | null>;
  /** Active Screens a node can reference; `null` when the Project is unavailable. */
  listScreens: (
    accountId: string,
    projectId: string,
  ) => Promise<ScreenOption[] | null>;
  /** Templates of the Workspace that owns the Project; `null` when unavailable. */
  listTemplates: (
    accountId: string,
    projectId: string,
  ) => Promise<UserFlowTemplateView[] | null>;
  /** Record ids the store cannot find are permanently deleted. Read-only. */
  lookupRecords: (
    accountId: string,
    refs: Array<{ id: string; kind: RecordLookupKind }>,
  ) => Promise<Map<string, RecordLookup>>;
  /** Screen ids the store cannot find are permanently deleted. */
  lookupScreens: (
    accountId: string,
    screenIds: string[],
  ) => Promise<Map<string, ScreenLookup>>;
  /** Read-only; writes nothing. */
  readConversionSource: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowConversionSource | null>;
  /**
   * Moves a bind to the previewed version only; the Origin Location stays.
   * `null` when the bind is unavailable.
   */
  rebind: (
    accountId: string,
    input: ParsedRebindUserFlowBindInput,
  ) => Promise<UserFlowBindRecord | null>;
  /** Upserts the account's own viewport of this canvas; no version is written. */
  saveViewport: (
    accountId: string,
    userFlowId: string,
    viewport: UserFlowViewport,
  ) => Promise<void>;
}

export interface UserFlowAccess {
  binds: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowBindView[]>;
  cardRecords: (
    accountId: string,
    projectId: string,
  ) => Promise<CardRecordOption[]>;
  convertNode: (
    accountId: string,
    input: ConvertUserFlowNodeInput,
  ) => Promise<UserFlowBindView>;
  create: (
    accountId: string,
    input: CreateUserFlowInput,
  ) => Promise<UserFlowView>;
  createFromTemplate: (
    accountId: string,
    input: CreateUserFlowFromTemplateInput,
  ) => Promise<UserFlowView>;
  get: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowView>;
  list: (accountId: string, projectId: string) => Promise<UserFlowSummary[]>;
  placeCard: (
    accountId: string,
    input: PlaceUserFlowCardInput,
  ) => Promise<UserFlowView>;
  placeNode: (
    accountId: string,
    input: PlaceUserFlowNodeInput,
  ) => Promise<UserFlowView>;
  previewConvert: (
    accountId: string,
    input: PreviewConvertUserFlowNodeInput,
  ) => Promise<UserFlowConvertPlan>;
  previewRebind: (
    accountId: string,
    input: PreviewRebindUserFlowBindInput,
  ) => Promise<UserFlowRebindPlan>;
  promoteToScreen: (
    accountId: string,
    input: PromoteUserFlowNodeInput,
  ) => Promise<UserFlowView>;
  rebind: (
    accountId: string,
    input: RebindUserFlowBindInput,
  ) => Promise<UserFlowBindView>;
  save: (
    accountId: string,
    input: SaveUserFlowVersionInput,
  ) => Promise<UserFlowView>;
  saveTemplate: (
    accountId: string,
    input: SaveUserFlowTemplateInput,
  ) => Promise<UserFlowTemplateView>;
  /** Writes only the caller's own viewport; never a version, relation or snapshot. */
  saveViewport: (
    accountId: string,
    input: SaveUserFlowViewportInput,
  ) => Promise<UserFlowViewport>;
  screens: (accountId: string, projectId: string) => Promise<ScreenOption[]>;
  templates: (
    accountId: string,
    projectId: string,
  ) => Promise<UserFlowTemplateView[]>;
  /** The caller's own saved viewport of this canvas, or `null`. */
  viewport: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowViewport | null>;
}

// --- Live records: read-only cards and the records a bind opened -----------

export type RecordLookupKind = "Decision" | "Open Question" | "Risk" | "Work";

/** What the owning stores can say about a record id; absence means permanently deleted. */
export type RecordLookup =
  | {
      archived: boolean;
      kind: "found";
      projectId: string;
      status: string | null;
      title: string;
      /** In Trash: a broken target that can still open its source. */
      trashed?: boolean;
    }
  | { kind: "inaccessible" };

export function recordLookupKey(kind: RecordLookupKind, recordId: string) {
  return `${kind}:${recordId}`;
}

const RECORD_SOURCE_PREFIXES: Record<RecordLookupKind, string> = {
  Decision: "source-decision-",
  "Open Question": "source-open-question-",
  Risk: "source-risk-",
  Work: "work-",
};

export function recordSourcePath(
  projectId: string,
  kind: RecordLookupKind,
  recordId: string,
) {
  return `/projects/${encodeURIComponent(projectId)}#${RECORD_SOURCE_PREFIXES[kind]}${encodeURIComponent(recordId)}`;
}

/** Live, read-only view of the source record behind a card or a bind. */
export interface RecordReferenceView {
  broken: BrokenReferenceView | null;
  kind: RecordLookupKind;
  /** Relative app path of the source record; null when it cannot be opened. */
  openPath: string | null;
  recordId: string;
  status: string | null;
  title: string | null;
}

/**
 * Resolves one record reference by its own id only. A permanently deleted,
 * foreign or cross-Project record is a broken target with no title or status;
 * an archived one stays readable and visibly `Archived`.
 */
export function resolveRecordReference(input: {
  flowProjectId: string;
  kind: RecordLookupKind;
  lookup: RecordLookup | undefined;
  placedAt: string;
  recordId: string;
}): RecordReferenceView {
  const { flowProjectId, kind, lookup, placedAt, recordId } = input;
  const broken = (
    reason: BrokenReferenceView["reason"],
  ): RecordReferenceView => ({
    broken: { canOpenSourceRecord: false, establishedAt: placedAt, reason },
    kind,
    openPath: null,
    recordId,
    status: null,
    title: null,
  });
  if (!lookup) {
    return broken("Permanently deleted");
  }
  if (lookup.kind === "inaccessible" || lookup.projectId !== flowProjectId) {
    return broken("No access");
  }
  if (lookup.trashed) {
    return {
      broken: {
        canOpenSourceRecord: true,
        establishedAt: placedAt,
        reason: "In Trash",
      },
      kind,
      openPath: recordSourcePath(flowProjectId, kind, recordId),
      recordId,
      status: null,
      title: null,
    };
  }
  return {
    broken: lookup.archived
      ? {
          canOpenSourceRecord: true,
          establishedAt: placedAt,
          reason: "Archived",
        }
      : null,
    kind,
    openPath: recordSourcePath(flowProjectId, kind, recordId),
    recordId,
    status: lookup.status,
    title: lookup.title,
  };
}

export interface CardRecordOption {
  id: string;
  kind: UserFlowCardKind;
  title: string;
}

export interface UserFlowCardView {
  id: string;
  placedAt: string;
  position: { x: number; y: number };
  record: RecordReferenceView;
}

export const placeUserFlowCardInputSchema = z
  .object({
    expectedVersion: versionSchema,
    kind: userFlowCardKindSchema,
    position: positionSchema.default({ x: 0, y: 0 }),
    projectId: identifierSchema,
    recordId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type PlaceUserFlowCardInput = z.input<
  typeof placeUserFlowCardInputSchema
>;

// --- Convert and Bind -------------------------------------------------------

/** The only targets of `Convert and Bind`; a Screen is promoted, never converted. */
export const USER_FLOW_CONVERT_TARGETS = [
  "Work",
  "Decision",
  "Risk",
  "Open Question",
] as const;
export const userFlowConvertTargetSchema = z.enum(USER_FLOW_CONVERT_TARGETS);
export type UserFlowConvertTarget = z.infer<typeof userFlowConvertTargetSchema>;

export const USER_FLOW_WORK_TYPES = [
  "Task",
  "Bug",
  "Research",
  "Improvement",
] as const;
const userFlowWorkTypeSchema = z.enum(USER_FLOW_WORK_TYPES);
export type UserFlowWorkType = z.infer<typeof userFlowWorkTypeSchema>;

export const previewConvertUserFlowNodeInputSchema = z
  .object({
    nodeId: identifierSchema,
    projectId: identifierSchema,
    target: userFlowConvertTargetSchema,
    userFlowId: identifierSchema,
    workType: userFlowWorkTypeSchema.default("Task"),
  })
  .strict();

export type PreviewConvertUserFlowNodeInput = z.input<
  typeof previewConvertUserFlowNodeInputSchema
>;

/** Origin Location of a bind: immutable once the record exists. */
export const userFlowOriginLocationSchema = z
  .object({
    flowVersion: versionSchema,
    nodeId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type UserFlowOriginLocation = z.infer<
  typeof userFlowOriginLocationSchema
>;

/**
 * Read-only `Convert and Bind` preview: exactly one record in the User Flow's
 * own Project, its title/body map, the `Origin` relation and the Origin
 * Location. Nothing exists until the founder confirms the exact plan.
 */
export const userFlowConvertPlanSchema = z
  .object({
    createsScreen: z.literal(false),
    nodeId: identifierSchema,
    originLocation: userFlowOriginLocationSchema,
    projectId: identifierSchema,
    recordCount: z.literal(1),
    record: z
      .object({
        body: z.string().min(1).max(100_000),
        title: z.string().min(1).max(255),
        type: userFlowConvertTargetSchema,
        workType: userFlowWorkTypeSchema.nullable(),
      })
      .strict(),
    relation: z.literal("Origin"),
    targetProject: z
      .object({ id: identifierSchema, name: z.string().min(1) })
      .strict(),
    userFlowId: identifierSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    if ((plan.record.type === "Work") !== (plan.record.workType !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only a Work has a Work type.",
        path: ["record", "workType"],
      });
    }
  });

export type UserFlowConvertPlan = z.infer<typeof userFlowConvertPlanSchema>;

export const convertUserFlowNodeInputSchema = humanMutationEnvelopeSchema
  .extend({
    /** Identity of the bind; the Mutation Contract target. */
    id: identifierSchema,
    nodeId: identifierSchema,
    plan: userFlowConvertPlanSchema,
    projectId: identifierSchema,
    /** Identity of the single new record. */
    recordId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type ConvertUserFlowNodeInput = z.input<
  typeof convertUserFlowNodeInputSchema
>;
export type ParsedConvertUserFlowNodeInput = z.output<
  typeof convertUserFlowNodeInputSchema
>;

export interface UserFlowConversionSource {
  projectName: string;
  record: UserFlowRecord;
}

function firstLine(text: string) {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
}

/**
 * The one mapping rule: the first line of the node text titles the record and
 * the whole node text is its body. No AI, no summary, no extra records. `null`
 * when the node is not in the exact current version.
 */
export function buildUserFlowConvertPlan(
  source: UserFlowConversionSource,
  input: {
    nodeId: string;
    target: UserFlowConvertTarget;
    workType: UserFlowWorkType;
  },
): UserFlowConvertPlan | null {
  const { record } = source;
  const node = record.document.nodes.find(({ id }) => id === input.nodeId);
  if (!node) {
    return null;
  }
  const title = (
    firstLine(node.text) || `${node.kind} node of ${record.title}`
  ).slice(0, 255);
  return userFlowConvertPlanSchema.parse({
    createsScreen: false,
    nodeId: node.id,
    originLocation: {
      flowVersion: record.version,
      nodeId: node.id,
      userFlowId: record.id,
    },
    projectId: record.projectId,
    record: {
      body: node.text.trim() || title,
      title,
      type: input.target,
      workType:
        input.target === "Work" ? workTypeSchema.parse(input.workType) : null,
    },
    recordCount: 1,
    relation: "Origin",
    targetProject: { id: record.projectId, name: source.projectName },
    userFlowId: record.id,
  });
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

/** A confirmed plan must equal the plan re-derived from the current record. */
export function isSameUserFlowPlan(left: unknown, right: unknown) {
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
}

/** Durable bind of one node to the one record it opened. */
export interface UserFlowBindRecord {
  boundVersion: number;
  createdAt: string;
  id: string;
  nodeId: string;
  /** Immutable: the exact flow version the record was opened from. */
  originVersion: number;
  recordId: string;
  recordType: UserFlowConvertTarget;
  revision: number;
  updatedAt: string;
  userFlowId: string;
}

export interface UserFlowBindNodeView {
  kind: UserFlowNodeKind;
  text: string;
}

export interface UserFlowBindView {
  boundVersion: number;
  createdAt: string;
  id: string;
  /** The node as it reads at the bound version; null when that version has no such node. */
  node: UserFlowBindNodeView | null;
  /** Immutable Origin Location with the node as it read at that exact version. */
  origin: UserFlowOriginLocation & { node: UserFlowBindNodeView | null };
  /** True only when a newer version has the node and the bind may be rebound. */
  rebindAvailable: boolean;
  record: RecordReferenceView;
  revision: number;
}

function nodeAt(
  document: UserFlowDocument | null,
  nodeId: string,
): UserFlowBindNodeView | null {
  const node = document?.nodes.find(({ id }) => id === nodeId);
  return node ? { kind: node.kind, text: node.text } : null;
}

export function buildUserFlowBindView(input: {
  bind: UserFlowBindRecord;
  boundDocument: UserFlowDocument | null;
  current: UserFlowRecord;
  lookup: RecordLookup | undefined;
  originDocument: UserFlowDocument | null;
}): UserFlowBindView {
  const { bind, current } = input;
  return {
    boundVersion: bind.boundVersion,
    createdAt: bind.createdAt,
    id: bind.id,
    node: nodeAt(input.boundDocument, bind.nodeId),
    origin: {
      flowVersion: bind.originVersion,
      node: nodeAt(input.originDocument, bind.nodeId),
      nodeId: bind.nodeId,
      userFlowId: bind.userFlowId,
    },
    rebindAvailable:
      bind.boundVersion < current.version &&
      nodeAt(current.document, bind.nodeId) !== null,
    record: resolveRecordReference({
      flowProjectId: current.projectId,
      kind: bind.recordType,
      lookup: input.lookup,
      placedAt: bind.createdAt,
      recordId: bind.recordId,
    }),
    revision: bind.revision,
  };
}

// --- Rebind (explicit, previewed) ------------------------------------------

export const previewRebindUserFlowBindInputSchema = z
  .object({
    bindId: identifierSchema,
    projectId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type PreviewRebindUserFlowBindInput = z.input<
  typeof previewRebindUserFlowBindInputSchema
>;

/** The exact move a rebind would make; the Origin Location is shown and never changes. */
export const userFlowRebindPlanSchema = z
  .object({
    bindId: identifierSchema,
    bindRevision: versionSchema,
    fromVersion: versionSchema,
    nodeId: identifierSchema,
    originLocation: userFlowOriginLocationSchema,
    projectId: identifierSchema,
    recordId: identifierSchema,
    recordType: userFlowConvertTargetSchema,
    toVersion: versionSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type UserFlowRebindPlan = z.infer<typeof userFlowRebindPlanSchema>;

export const rebindUserFlowBindInputSchema = z
  .object({
    bindId: identifierSchema,
    plan: userFlowRebindPlanSchema,
    projectId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type RebindUserFlowBindInput = z.input<
  typeof rebindUserFlowBindInputSchema
>;
export type ParsedRebindUserFlowBindInput = z.output<
  typeof rebindUserFlowBindInputSchema
>;

/** `null` when the bind is already on the current version or the node left it. */
export function buildUserFlowRebindPlan(
  current: UserFlowRecord,
  bind: UserFlowBindRecord,
): UserFlowRebindPlan | null {
  if (
    bind.boundVersion >= current.version ||
    nodeAt(current.document, bind.nodeId) === null
  ) {
    return null;
  }
  return userFlowRebindPlanSchema.parse({
    bindId: bind.id,
    bindRevision: bind.revision,
    fromVersion: bind.boundVersion,
    nodeId: bind.nodeId,
    originLocation: {
      flowVersion: bind.originVersion,
      nodeId: bind.nodeId,
      userFlowId: bind.userFlowId,
    },
    projectId: current.projectId,
    recordId: bind.recordId,
    recordType: bind.recordType,
    toVersion: current.version,
    userFlowId: current.id,
  });
}

// --- Promote to Screen (a separate action, a live reference) ---------------

export const promoteUserFlowNodeInputSchema = z
  .object({
    expectedVersion: versionSchema,
    nodeId: identifierSchema,
    projectId: identifierSchema,
    /** Link an existing Screen, or create one Screen master with this title. */
    screen: z.discriminatedUnion("mode", [
      z
        .object({ mode: z.literal("link"), screenId: identifierSchema })
        .strict(),
      z
        .object({
          mode: z.literal("create"),
          screenId: identifierSchema.optional(),
          title: z.string().trim().min(1).max(255),
        })
        .strict(),
    ]),
    userFlowId: identifierSchema,
  })
  .strict();

export type PromoteUserFlowNodeInput = z.input<
  typeof promoteUserFlowNodeInputSchema
>;

// --- Templates: structure and placeholders only -----------------------------

export const userFlowTemplateNameSchema = z
  .string()
  .trim()
  .min(1, "Template name is required.")
  .max(255, "Template name must be 255 characters or fewer.");

export const saveUserFlowTemplateInputSchema = z
  .object({
    id: identifierSchema.optional(),
    name: userFlowTemplateNameSchema,
    /** The selected structure; links between selected nodes come along. */
    nodeIds: z.array(identifierSchema).min(1).max(USER_FLOW_NODE_LIMIT),
    projectId: identifierSchema,
    userFlowId: identifierSchema,
  })
  .strict();

export type SaveUserFlowTemplateInput = z.input<
  typeof saveUserFlowTemplateInputSchema
>;

export const createUserFlowFromTemplateInputSchema = z
  .object({
    id: identifierSchema.optional(),
    projectId: identifierSchema,
    templateId: identifierSchema,
    title: userFlowTitleSchema,
  })
  .strict();

export type CreateUserFlowFromTemplateInput = z.input<
  typeof createUserFlowFromTemplateInputSchema
>;

export interface UserFlowTemplateView {
  createdAt: string;
  id: string;
  name: string;
  structure: UserFlowTemplateStructure;
}

/**
 * The stamp: the selected nodes and the links between them under
 * template-local ids. A Screen node keeps its kind but loses its Screen id; no
 * Work, Decision, Risk, card, relation, bind, version, publish state, history,
 * Project id or source node id is carried.
 */
export function buildUserFlowTemplateStructure(
  document: UserFlowDocument,
  nodeIds: readonly string[],
): UserFlowTemplateStructure {
  const selected = new Set(nodeIds);
  const chosen = document.nodes.filter(({ id }) => selected.has(id));
  const localId = new Map(
    chosen.map((node, index) => [node.id, `node-${index + 1}`]),
  );
  return {
    links: document.links.flatMap((link, index) => {
      const from = localId.get(link.from);
      const to = localId.get(link.to);
      return from && to
        ? [{ from, id: `link-${index + 1}`, text: link.text, to }]
        : [];
    }),
    nodes: chosen.map((node) => ({
      id: localId.get(node.id) as string,
      kind: node.kind,
      position: node.position,
      style: node.style ?? "default",
      text: node.text,
    })),
  };
}

/**
 * Stamps a template into a new document: fresh independent ids, no Screen ids
 * (a Screen node is an unlinked placeholder until the founder links a Screen
 * explicitly), no cards, no binds.
 */
export function instantiateUserFlowTemplate(
  structure: UserFlowTemplateStructure,
  createId: () => string,
  placedAt: string,
): UserFlowDocument {
  const fresh = new Map(structure.nodes.map((node) => [node.id, createId()]));
  return {
    links: structure.links.flatMap((link) => {
      const from = fresh.get(link.from);
      const to = fresh.get(link.to);
      return from && to ? [{ from, id: createId(), text: link.text, to }] : [];
    }),
    nodes: structure.nodes.map((node) => ({
      id: fresh.get(node.id) as string,
      kind: node.kind,
      placedAt,
      position: node.position,
      screenId: null,
      style: node.style,
      text: node.text,
    })),
  };
}

// --- Personal viewport (spec 49 #374) ----------------------------------------

export const USER_FLOW_MIN_ZOOM = 0.1;
export const USER_FLOW_MAX_ZOOM = 4;

/**
 * The account's own working position on this canvas: viewport center, zoom and
 * the view-local collapse of Sections. It is not part of the versioned
 * document, a relation, a share snapshot or an export, and never another
 * account's view. Selection, inspector, edit mode and unsaved operations are
 * deliberately absent from the shape.
 */
export const userFlowViewportSchema = z
  .object({
    center: positionSchema,
    /** Section node ids collapsed in this account's view only. */
    collapsed: z.array(identifierSchema).max(USER_FLOW_NODE_LIMIT).default([]),
    zoom: z.number().finite().min(USER_FLOW_MIN_ZOOM).max(USER_FLOW_MAX_ZOOM),
  })
  .strict();
export type UserFlowViewport = z.infer<typeof userFlowViewportSchema>;

export const saveUserFlowViewportInputSchema = z
  .object({
    projectId: identifierSchema,
    userFlowId: identifierSchema,
    viewport: userFlowViewportSchema,
  })
  .strict();
export type SaveUserFlowViewportInput = z.input<
  typeof saveUserFlowViewportInputSchema
>;

/** Section ids that still exist; a stale collapse never hides anything. */
export function liveCollapsedSections(
  nodes: ReadonlyArray<{ id: string; kind: string }>,
  collapsed: readonly string[],
) {
  const sections = new Set(
    nodes.filter(({ kind }) => kind === "Section").map(({ id }) => id),
  );
  return [...new Set(collapsed)].filter((id) => sections.has(id));
}

export interface UserFlowViewportContent {
  cards: Array<{ position: { x: number; y: number } }>;
  nodes: Array<{
    id: string;
    kind: string;
    position: { x: number; y: number };
    sectionId?: string | null;
  }>;
}

export type UserFlowViewportResolution =
  | { collapsed: string[]; mode: "fit" }
  | {
      collapsed: string[];
      mode: "restore";
      viewport: { center: { x: number; y: number }; zoom: number };
    };

/**
 * Decides whether a saved position still means something. It is restored only
 * when the visible rectangle it describes shows at least one visible item;
 * otherwise (nothing saved, nothing to show, a deleted or moved region, an
 * empty gap) the canvas fits visible content instead of opening on empty
 * space. Items hidden by a collapsed Section do not count as content.
 */
export function resolveUserFlowViewport(input: {
  content: UserFlowViewportContent;
  frame: { height: number; width: number };
  saved: UserFlowViewport | null;
}): UserFlowViewportResolution {
  const { content, frame, saved } = input;
  if (!saved) {
    return { collapsed: [], mode: "fit" };
  }
  const collapsed = liveCollapsedSections(content.nodes, saved.collapsed);
  const hidden = new Set(collapsed);
  const origins = [
    ...content.nodes
      .filter(({ sectionId }) => !(sectionId && hidden.has(sectionId)))
      .map(({ position }) => position),
    ...content.cards.map(({ position }) => position),
  ];
  if (
    origins.length === 0 ||
    !(
      saved.zoom >= USER_FLOW_MIN_ZOOM &&
      saved.zoom <= USER_FLOW_MAX_ZOOM &&
      frame.width > 0 &&
      frame.height > 0
    )
  ) {
    return { collapsed, mode: "fit" };
  }
  const halfWidth = frame.width / saved.zoom / 2;
  const halfHeight = frame.height / saved.zoom / 2;
  const left = saved.center.x - halfWidth;
  const right = saved.center.x + halfWidth;
  const top = saved.center.y - halfHeight;
  const bottom = saved.center.y + halfHeight;
  const sees = origins.some(
    ({ x, y }) =>
      x < right &&
      x + USER_FLOW_NODE_WIDTH > left &&
      y < bottom &&
      y + USER_FLOW_NODE_HEIGHT > top,
  );
  return sees
    ? {
        collapsed,
        mode: "restore",
        viewport: { center: saved.center, zoom: saved.zoom },
      }
    : { collapsed, mode: "fit" };
}
