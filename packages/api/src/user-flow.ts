import type { UserFlowDocument } from "@cantiara/db/schema/user-flow";
import { z } from "zod";

import type { BrokenReferenceView } from "./relations";

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

/** Hard performance scene of the editor; a document never exceeds it. */
export const USER_FLOW_NODE_LIMIT = 500;
export const USER_FLOW_LINK_LIMIT = 750;

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
  /** The only Screen data a node holds: the live reference. Never a copy. */
  screenId: identifierSchema.nullable().default(null),
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
    links: z.array(userFlowLinkInputSchema).max(USER_FLOW_LINK_LIMIT),
    nodes: z.array(userFlowNodeInputSchema).max(USER_FLOW_NODE_LIMIT),
  })
  .strict()
  .superRefine((document, context) => {
    const nodeIds = new Set(document.nodes.map(({ id }) => id));
    if (nodeIds.size !== document.nodes.length) {
      context.addIssue({ code: "custom", message: "Duplicate node id." });
    }
    if (
      new Set(document.links.map(({ id }) => id)).size !== document.links.length
    ) {
      context.addIssue({ code: "custom", message: "Duplicate link id." });
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
  text: string;
}

export interface UserFlowView {
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
): UserFlowView {
  return {
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
  find: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowRecord | null>;
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<UserFlowRecord[] | null>;
  /** Active Screens a node can reference; `null` when the Project is unavailable. */
  listScreens: (
    accountId: string,
    projectId: string,
  ) => Promise<ScreenOption[] | null>;
  /** Screen ids the store cannot find are permanently deleted. */
  lookupScreens: (
    accountId: string,
    screenIds: string[],
  ) => Promise<Map<string, ScreenLookup>>;
}

export interface UserFlowAccess {
  create: (
    accountId: string,
    input: CreateUserFlowInput,
  ) => Promise<UserFlowView>;
  get: (
    accountId: string,
    projectId: string,
    userFlowId: string,
  ) => Promise<UserFlowView>;
  list: (accountId: string, projectId: string) => Promise<UserFlowSummary[]>;
  placeNode: (
    accountId: string,
    input: PlaceUserFlowNodeInput,
  ) => Promise<UserFlowView>;
  save: (
    accountId: string,
    input: SaveUserFlowVersionInput,
  ) => Promise<UserFlowView>;
  screens: (accountId: string, projectId: string) => Promise<ScreenOption[]>;
}
