import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import type {
  ExportProjectWallSnapshotInput,
  PreviewProjectWallSnapshotInput,
  ProjectWallSnapshotOutput,
  ProjectWallSnapshotPreview,
  SetProjectWallFocusOrderInput,
} from "./project-wall-presentation";
import {
  type RelationCreateInput,
  type RelationCreatePreviewInput,
  type RelationEndpoint,
  type RelationMutationResult,
  type RelationPreview,
  relationKindSchema,
} from "./relations";
import type { SmartCollectionsAccess } from "./smart-collections";
import type { TechnicalDiagramsAccess } from "./technical-diagrams";
import {
  type RecordLookup,
  type RecordReferenceView,
  resolveRecordReference,
} from "./user-flow";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Master record types a Project Wall card can reference. A card is a live
 * reference to one of these by source id; the wall never stores a copy.
 * `Technical Diagram` is a read-only live preview of a Diagram View and
 * `Smart Collection` (`Akıllı Koleksiyon`) is a read-only live summary block;
 * for the latter `source_id` is the collection view id.
 */
export const PROJECT_WALL_SOURCE_TYPES = [
  "Work",
  "Decision",
  "Risk",
  "Technical Diagram",
  "Smart Collection",
] as const;
export const projectWallSourceTypeSchema = z.enum(PROJECT_WALL_SOURCE_TYPES);
export type ProjectWallSourceType = z.infer<typeof projectWallSourceTypeSchema>;

/** Source types owned by the planning stores the wall reads field by field. */
export type ProjectWallRecordSourceType = "Decision" | "Risk" | "Work";

/** Stable key of one source reference inside a lookup map. */
export function projectWallLookupKey(
  sourceType: ProjectWallSourceType,
  recordId: string,
) {
  return `${sourceType}:${recordId}`;
}

/** Relative app path of a diagram or collection source. */
export function projectWallExtraSourcePath(
  projectId: string,
  sourceType: "Smart Collection" | "Technical Diagram",
  recordId: string,
) {
  const anchor =
    sourceType === "Smart Collection"
      ? "smart-collection-view-"
      : "technical-diagram-";
  return `/projects/${encodeURIComponent(projectId)}#${anchor}${encodeURIComponent(recordId)}`;
}

/** Most records the Smart Collection block lists; the rest opens in source. */
export const PROJECT_WALL_COLLECTION_SUMMARY_LIMIT = 5;
/** Most diagram nodes the card previews. */
export const PROJECT_WALL_DIAGRAM_PREVIEW_NODE_LIMIT = 40;

/** Closed card densities. The product, not the card, chooses the fields. */
export const PROJECT_WALL_DENSITIES = [
  "Compact",
  "Preview",
  "Detailed",
] as const;
export const projectWallDensitySchema = z.enum(PROJECT_WALL_DENSITIES);
export type ProjectWallDensity = z.infer<typeof projectWallDensitySchema>;
export const DEFAULT_PROJECT_WALL_DENSITY: ProjectWallDensity = "Preview";

/** Limited accessible highlight palette; a highlight is wall narrative only. */
export const PROJECT_WALL_HIGHLIGHTS = [
  "blue",
  "green",
  "amber",
  "red",
  "violet",
] as const;
export const projectWallHighlightSchema = z.enum(PROJECT_WALL_HIGHLIGHTS);
export type ProjectWallHighlight = z.infer<typeof projectWallHighlightSchema>;

/** Source fields a card may show; each is read live from the master record. */
export const PROJECT_WALL_FIELD_NAMES = [
  "Key",
  "Status",
  "Type",
  "Description",
  "Decision",
  "Probability",
  "Impact",
] as const;
export type ProjectWallFieldName = (typeof PROJECT_WALL_FIELD_NAMES)[number];

/**
 * Product-chosen fields per source type and density. The title is always the
 * card heading and is not listed. There is no per-card field builder.
 */
export const PROJECT_WALL_DENSITY_FIELDS: Record<
  ProjectWallSourceType,
  Record<ProjectWallDensity, readonly ProjectWallFieldName[]>
> = {
  "Smart Collection": { Compact: [], Detailed: [], Preview: [] },
  "Technical Diagram": { Compact: [], Detailed: [], Preview: [] },
  Decision: {
    Compact: [],
    Detailed: ["Status", "Decision"],
    Preview: ["Status"],
  },
  Risk: {
    Compact: [],
    Detailed: ["Status", "Probability", "Impact"],
    Preview: ["Status"],
  },
  Work: {
    Compact: ["Key"],
    Detailed: ["Key", "Status", "Type", "Description"],
    Preview: ["Key", "Status", "Type"],
  },
};

const coordinateSchema = z.number().finite().min(-100_000).max(100_000);
export const projectWallPositionSchema = z
  .object({ x: coordinateSchema, y: coordinateSchema })
  .strict();
export type ProjectWallPosition = z.infer<typeof projectWallPositionSchema>;

export const projectWallTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(255);

// Every input is strict: a wall takes no parent, Workspace or body, and a card
// takes no title, note, task or file.
export const projectWallProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const projectWallInputSchema = z
  .object({ projectId: identifierSchema, wallId: identifierSchema })
  .strict();

export const createProjectWallInputSchema = z
  .object({ projectId: identifierSchema, title: projectWallTitleSchema })
  .strict();
export type CreateProjectWallInput = z.input<
  typeof createProjectWallInputSchema
>;

export const renameProjectWallInputSchema = projectWallInputSchema
  .extend({ title: projectWallTitleSchema })
  .strict();
export type RenameProjectWallInput = z.input<
  typeof renameProjectWallInputSchema
>;

export const addProjectWallCardInputSchema = projectWallInputSchema
  .extend({
    density: projectWallDensitySchema.default(DEFAULT_PROJECT_WALL_DENSITY),
    // The selected Diagram View of a Technical Diagram card (its default view
    // when omitted). No other source type takes it.
    diagramViewId: identifierSchema.optional(),
    position: projectWallPositionSchema.default({ x: 0, y: 0 }),
    sourceId: identifierSchema,
    sourceType: projectWallSourceTypeSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.diagramViewId === undefined ||
      input.sourceType === "Technical Diagram",
    {
      message: "Only a Technical Diagram card selects a Diagram View.",
      path: ["diagramViewId"],
    },
  );
export type AddProjectWallCardInput = z.input<
  typeof addProjectWallCardInputSchema
>;
export type ParsedAddProjectWallCardInput = z.output<
  typeof addProjectWallCardInputSchema
>;

export const moveProjectWallCardsInputSchema = projectWallInputSchema
  .extend({
    moves: z
      .array(
        z
          .object({
            cardId: identifierSchema,
            position: projectWallPositionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();
export type MoveProjectWallCardsInput = z.input<
  typeof moveProjectWallCardsInputSchema
>;

export const setProjectWallCardDensityInputSchema = projectWallInputSchema
  .extend({ cardId: identifierSchema, density: projectWallDensitySchema })
  .strict();
export type SetProjectWallCardDensityInput = z.input<
  typeof setProjectWallCardDensityInputSchema
>;

export const setProjectWallCardHighlightInputSchema = projectWallInputSchema
  .extend({
    cardId: identifierSchema,
    highlight: projectWallHighlightSchema.nullable(),
  })
  .strict();
export type SetProjectWallCardHighlightInput = z.input<
  typeof setProjectWallCardHighlightInputSchema
>;

export const removeProjectWallCardInputSchema = projectWallInputSchema
  .extend({ cardId: identifierSchema })
  .strict();
export type RemoveProjectWallCardInput = z.input<
  typeof removeProjectWallCardInputSchema
>;

// --- Visual links, groups and Lock Position -----------------------------------

/**
 * A `Visual link` is directed (`From` -> `To`) and labeled wall narrative. It
 * is wall view state: drawing one never writes a relation row.
 */
export const drawProjectWallLinkInputSchema = projectWallInputSchema
  .extend({
    fromCardId: identifierSchema,
    label: z.string().trim().min(1, "Label is required.").max(120),
    toCardId: identifierSchema,
  })
  .strict()
  .refine((input) => input.fromCardId !== input.toCardId, {
    message: "A Visual link needs two different cards.",
    path: ["toCardId"],
  });
export type DrawProjectWallLinkInput = z.input<
  typeof drawProjectWallLinkInputSchema
>;

export const unbindProjectWallLinkInputSchema = projectWallInputSchema
  .extend({ linkId: identifierSchema })
  .strict();
export type UnbindProjectWallLinkInput = z.input<
  typeof unbindProjectWallLinkInputSchema
>;

export const previewProjectWallPersistentRelationInputSchema =
  projectWallInputSchema
    .extend({ kind: relationKindSchema, linkId: identifierSchema })
    .strict();
export type PreviewProjectWallPersistentRelationInput = z.input<
  typeof previewProjectWallPersistentRelationInputSchema
>;

/** Writing needs the preview id of the same link, kind and card endpoints. */
export const createProjectWallPersistentRelationInputSchema =
  humanMutationEnvelopeSchema
    .extend({
      kind: relationKindSchema,
      linkId: identifierSchema,
      previewId: identifierSchema,
      projectId: identifierSchema,
      wallId: identifierSchema,
    })
    .strict();
export type CreateProjectWallPersistentRelationInput = z.input<
  typeof createProjectWallPersistentRelationInputSchema
>;

export const setProjectWallCardLockInputSchema = projectWallInputSchema
  .extend({ cardId: identifierSchema, locked: z.boolean() })
  .strict();
export type SetProjectWallCardLockInput = z.input<
  typeof setProjectWallCardLockInputSchema
>;

// Groups are single-level and named: no parent group, no colour, no kind.
export const createProjectWallGroupInputSchema = projectWallInputSchema
  .extend({ title: projectWallTitleSchema })
  .strict();
export type CreateProjectWallGroupInput = z.input<
  typeof createProjectWallGroupInputSchema
>;

export const projectWallGroupInputSchema = projectWallInputSchema
  .extend({ groupId: identifierSchema })
  .strict();
export type ProjectWallGroupInput = z.input<typeof projectWallGroupInputSchema>;

export const setProjectWallGroupCollapsedInputSchema =
  projectWallGroupInputSchema.extend({ collapsed: z.boolean() }).strict();
export type SetProjectWallGroupCollapsedInput = z.input<
  typeof setProjectWallGroupCollapsedInputSchema
>;

export const setProjectWallCardGroupInputSchema = projectWallInputSchema
  .extend({ cardId: identifierSchema, groupId: identifierSchema.nullable() })
  .strict();
export type SetProjectWallCardGroupInput = z.input<
  typeof setProjectWallCardGroupInputSchema
>;

// --- Stored records ---------------------------------------------------------

export interface ProjectWallItemRecord {
  density: ProjectWallDensity;
  /** Selected Diagram View of a Technical Diagram card; otherwise null. */
  diagramViewId: string | null;
  /** Wall-only group membership; never a relation or classification. */
  groupId: string | null;
  highlight: ProjectWallHighlight | null;
  id: string;
  /** View-local `Lock Position`; says nothing about the source record. */
  locked: boolean;
  placedAt: string;
  position: ProjectWallPosition;
  sourceId: string;
  sourceType: ProjectWallSourceType;
}

export interface ProjectWallGroupRecord {
  collapsed: boolean;
  id: string;
  title: string;
}

/** A directed, labeled line between two cards of one wall; not a relation. */
export interface ProjectWallLinkRecord {
  fromCardId: string;
  id: string;
  label: string;
  toCardId: string;
}

export interface ProjectWallRecord {
  createdAt: string;
  /** Optional `Focus order`: card ids in presentation sequence, view metadata. */
  focusOrder: string[];
  groups: ProjectWallGroupRecord[];
  id: string;
  items: ProjectWallItemRecord[];
  links: ProjectWallLinkRecord[];
  projectId: string;
  title: string;
  updatedAt: string;
}

export interface ProjectWallSummary {
  cardCount: number;
  createdAt: string;
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
}

/** A live source record as the owning store reads it; never written by the wall. */
export type ProjectWallSourceLookup =
  | {
      archived: boolean;
      kind: "found";
      projectId: string;
      status: string | null;
      /** Live read-only data of a diagram or collection source. */
      preview?: ProjectWallPreviewData;
      title: string;
      trashed?: boolean;
      values: Partial<Record<ProjectWallFieldName, string | null>>;
    }
  | { kind: "inaccessible" };

export interface ProjectWallSourceOption {
  /** Selected Diagram View of a Technical Diagram option. */
  diagramViewId?: string;
  id: string;
  sourceType: ProjectWallSourceType;
  title: string;
}

// --- Read-only previews: Technical Diagram and Smart Collection -----------------

/**
 * Live read-only preview of the selected Diagram View. `pin` labels it `Live`
 * (follows the diagram) or `Exact` (an explicitly selected Diagram Version);
 * the wall can only read it, never edit nodes, links or views.
 */
export interface ProjectWallDiagramPreview {
  diagramType: string;
  kind: "Technical Diagram";
  links: Array<{ from: string; label: string | null; to: string }>;
  nodes: Array<{ id: string; kind: string; label: string }>;
  pin: "Exact" | "Live";
  viewName: string | null;
}

/** One record of a Smart Collection result, as the collection reports it. */
export interface ProjectWallCollectionRecord {
  id: string;
  recordType: string;
  status: string | null;
  title: string;
}

/** Collection result as the owning feature reports it; the wall adds no query. */
export interface ProjectWallCollectionData {
  collectionName: string;
  kind: "Smart Collection";
  openAllPath: string;
  records: ProjectWallCollectionRecord[];
  total: number;
}

export type ProjectWallPreviewData =
  | ProjectWallCollectionData
  | ProjectWallDiagramPreview;

export interface ProjectWallCollectionSummaryItem {
  id: string;
  recordType: string;
  /** The same record is also a card on this wall: one record, not two. */
  sharedWithCard: boolean;
  status: string | null;
  title: string;
}

/** Read-only live summary block of a named Smart Collection. */
export interface ProjectWallCollectionPreview {
  collectionName: string;
  items: ProjectWallCollectionSummaryItem[];
  kind: "Smart Collection";
  limit: number;
  /** `Open all in source`: the whole result lives in the collection. */
  openAllPath: string;
  total: number;
}

export type ProjectWallCardPreview =
  | ProjectWallCollectionPreview
  | ProjectWallDiagramPreview;

/** The live source of a card; its kind is the card's source type. */
export type ProjectWallSourceReference = Omit<RecordReferenceView, "kind"> & {
  kind: ProjectWallSourceType;
};

// --- Views ------------------------------------------------------------------

export interface ProjectWallCardField {
  name: ProjectWallFieldName;
  value: string;
}

export interface ProjectWallCardView {
  /** Wall view state only: none of these is ever a source field. */
  density: ProjectWallDensity;
  /** Product-chosen source fields for this type at this density. */
  fields: ProjectWallCardField[];
  /** Wall-only group membership; `null` when ungrouped. */
  groupId: string | null;
  highlight: ProjectWallHighlight | null;
  id: string;
  /** `Lock Position`: fixes this card in manual drag, view-local. */
  locked: boolean;
  placedAt: string;
  position: ProjectWallPosition;
  /** Read-only live preview of a diagram or collection source; else null. */
  preview: ProjectWallCardPreview | null;
  /** `Shared source`: this record also appears inside a collection block here. */
  sharedSource: boolean;
  /** The live master record: `source.recordId` is the source id itself. */
  source: ProjectWallSourceReference;
  sourceType: ProjectWallSourceType;
}

export type ProjectWallGroupView = ProjectWallGroupRecord;

/** A `Visual link`: wall narrative only, never counted as a record relation. */
export type ProjectWallLinkView = ProjectWallLinkRecord;

export interface ProjectWallView {
  cards: ProjectWallCardView[];
  createdAt: string;
  /** Optional `Focus order` of `Presentation Mode`; wall view metadata. */
  focusOrder: string[];
  groups: ProjectWallGroupView[];
  id: string;
  links: ProjectWallLinkView[];
  projectId: string;
  title: string;
  updatedAt: string;
}

const FIELD_VALUE_LIMIT = 280;

function clip(value: string) {
  return value.length > FIELD_VALUE_LIMIT
    ? `${value.slice(0, FIELD_VALUE_LIMIT - 1)}…`
    : value;
}

/** The source fields a card shows for a type and density, read live. */
export function projectWallCardFields(
  sourceType: ProjectWallSourceType,
  density: ProjectWallDensity,
  lookup: ProjectWallSourceLookup | undefined,
): ProjectWallCardField[] {
  if (lookup?.kind !== "found") {
    return [];
  }
  return PROJECT_WALL_DENSITY_FIELDS[sourceType][density].flatMap((name) => {
    const value =
      name === "Status" ? lookup.status : (lookup.values[name] ?? null);
    const text = value?.trim();
    return text ? [{ name, value: clip(text) }] : [];
  });
}

/**
 * Resolves a card source through the common broken-reference presentation. A
 * diagram or collection source reuses its rules and only changes the kind and
 * the path that `Open Source Record` follows.
 */
function resolveSourceReference(
  projectId: string,
  item: Pick<ProjectWallItemRecord, "placedAt" | "sourceId" | "sourceType">,
  lookup: ProjectWallSourceLookup | undefined,
): ProjectWallSourceReference {
  const { sourceId, sourceType } = item;
  const extra =
    sourceType === "Smart Collection" || sourceType === "Technical Diagram";
  const base = resolveRecordReference({
    flowProjectId: projectId,
    kind: extra ? "Work" : sourceType,
    lookup: lookup as RecordLookup | undefined,
    placedAt: item.placedAt,
    recordId: sourceId,
  });
  return extra
    ? {
        ...base,
        kind: sourceType,
        openPath: base.openPath
          ? projectWallExtraSourcePath(projectId, sourceType, sourceId)
          : null,
      }
    : { ...base, kind: sourceType };
}

/**
 * Builds the wall view. Each card resolves its source id through the common
 * broken-reference presentation: a trashed, archived, deleted or inaccessible
 * record is explained and never retargeted. Broken cards show no fields.
 */
export function buildProjectWallView(
  record: ProjectWallRecord,
  lookups: ReadonlyMap<string, ProjectWallSourceLookup>,
): ProjectWallView {
  const onWall = new Set(
    record.items.map((item) =>
      projectWallLookupKey(item.sourceType, item.sourceId),
    ),
  );
  const shown = new Set<string>();
  const cards = record.items.map((item): ProjectWallCardView => {
    const lookup = lookups.get(
      projectWallLookupKey(item.sourceType, item.sourceId),
    );
    const source = resolveSourceReference(record.projectId, item, lookup);
    const readable =
      source.broken === null || source.broken.reason === "Archived";
    const data =
      readable && lookup?.kind === "found" ? lookup.preview : undefined;
    let preview: ProjectWallCardPreview | null = null;
    if (data?.kind === "Technical Diagram") {
      preview = data;
    } else if (data?.kind === "Smart Collection") {
      preview = {
        collectionName: data.collectionName,
        items: data.records
          .slice(0, PROJECT_WALL_COLLECTION_SUMMARY_LIMIT)
          .map((entry) => {
            const key = `${entry.recordType}:${entry.id}`;
            shown.add(key);
            return { ...entry, sharedWithCard: onWall.has(key) };
          }),
        kind: "Smart Collection",
        limit: PROJECT_WALL_COLLECTION_SUMMARY_LIMIT,
        openAllPath: data.openAllPath,
        total: data.total,
      };
    }
    return {
      density: item.density,
      fields: readable
        ? projectWallCardFields(item.sourceType, item.density, lookup)
        : [],
      groupId: item.groupId,
      highlight: item.highlight,
      id: item.id,
      locked: item.locked,
      placedAt: item.placedAt,
      position: item.position,
      preview,
      sharedSource: false,
      source,
      sourceType: item.sourceType,
    };
  });
  return {
    cards: cards.map((card) => ({
      ...card,
      sharedSource: shown.has(`${card.sourceType}:${card.source.recordId}`),
    })),
    createdAt: record.createdAt,
    focusOrder: record.focusOrder,
    groups: record.groups,
    id: record.id,
    links: record.links,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
  };
}

/**
 * The relation endpoint a card stands for: its live source record. A Smart
 * Collection block summarizes records and is not a relation endpoint (null).
 */
export function projectWallCardEndpoint(
  card: Pick<ProjectWallItemRecord, "sourceId" | "sourceType">,
): RelationEndpoint | null {
  return card.sourceType === "Smart Collection"
    ? null
    : { recordId: card.sourceId, recordType: card.sourceType };
}

// --- Seams ------------------------------------------------------------------

/**
 * Persistence of walls and their cards. It deliberately has no method that
 * writes a source record: moving, restyling or removing a card touches only
 * wall rows.
 */
export interface ProjectWallStore {
  addCard: (
    accountId: string,
    input: {
      density: ProjectWallDensity;
      diagramViewId: string | null;
      id: string;
      placedAt: string;
      position: ProjectWallPosition;
      projectId: string;
      sourceId: string;
      sourceType: ProjectWallSourceType;
      wallId: string;
    },
  ) => Promise<ProjectWallItemRecord | null>;
  addLink: (
    accountId: string,
    input: {
      fromCardId: string;
      id: string;
      label: string;
      projectId: string;
      toCardId: string;
      wallId: string;
    },
  ) => Promise<ProjectWallLinkRecord | null>;
  createGroup: (
    accountId: string,
    input: {
      id: string;
      projectId: string;
      title: string;
      wallId: string;
    },
  ) => Promise<ProjectWallGroupRecord | null>;
  createWall: (
    accountId: string,
    input: { id: string; projectId: string; title: string },
  ) => Promise<ProjectWallRecord | null>;
  deleteGroup: (
    accountId: string,
    input: { groupId: string; projectId: string; wallId: string },
  ) => Promise<boolean>;
  deleteWall: (
    accountId: string,
    projectId: string,
    wallId: string,
  ) => Promise<boolean>;
  findWall: (
    accountId: string,
    projectId: string,
    wallId: string,
  ) => Promise<ProjectWallRecord | null>;
  listSourceOptions: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSourceOption[] | null>;
  listWalls: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSummary[] | null>;
  lookupSources: (
    accountId: string,
    refs: Array<{ id: string; sourceType: ProjectWallRecordSourceType }>,
  ) => Promise<Map<string, ProjectWallSourceLookup>>;
  moveCards: (
    accountId: string,
    input: {
      moves: Array<{ cardId: string; position: ProjectWallPosition }>;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
  removeCard: (
    accountId: string,
    input: { cardId: string; projectId: string; wallId: string },
  ) => Promise<boolean>;
  removeLink: (
    accountId: string,
    input: { linkId: string; projectId: string; wallId: string },
  ) => Promise<boolean>;
  renameWall: (
    accountId: string,
    input: { projectId: string; title: string; wallId: string },
  ) => Promise<boolean>;
  setCardDensity: (
    accountId: string,
    input: {
      cardId: string;
      density: ProjectWallDensity;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
  setCardGroup: (
    accountId: string,
    input: {
      cardId: string;
      groupId: string | null;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
  setCardHighlight: (
    accountId: string,
    input: {
      cardId: string;
      highlight: ProjectWallHighlight | null;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
  setCardLocked: (
    accountId: string,
    input: {
      cardId: string;
      locked: boolean;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
  /** Replaces the `Focus order` with existing cards of the wall; [] clears it. */
  setFocusOrder: (
    accountId: string,
    input: { cardIds: string[]; projectId: string; wallId: string },
  ) => Promise<boolean>;
  setGroupCollapsed: (
    accountId: string,
    input: {
      collapsed: boolean;
      groupId: string;
      projectId: string;
      wallId: string;
    },
  ) => Promise<boolean>;
}

export interface ProjectWallAccess {
  addCard: (
    accountId: string,
    input: AddProjectWallCardInput,
  ) => Promise<ProjectWallView>;
  create: (
    accountId: string,
    input: CreateProjectWallInput,
  ) => Promise<ProjectWallView>;
  createGroup: (
    accountId: string,
    input: CreateProjectWallGroupInput,
  ) => Promise<ProjectWallView>;
  /** Writes the catalog relation only after its preview id is presented. */
  createPersistentRelation: (
    accountId: string,
    input: CreateProjectWallPersistentRelationInput,
  ) => Promise<RelationMutationResult>;
  delete: (
    accountId: string,
    projectId: string,
    wallId: string,
  ) => Promise<void>;
  deleteGroup: (
    accountId: string,
    input: ProjectWallGroupInput,
  ) => Promise<ProjectWallView>;
  drawLink: (
    accountId: string,
    input: DrawProjectWallLinkInput,
  ) => Promise<ProjectWallView>;
  /** Dated `Frozen copy` of a group or region; writes nothing. */
  exportSnapshot: (
    accountId: string,
    input: ExportProjectWallSnapshotInput,
  ) => Promise<ProjectWallSnapshotOutput>;
  get: (
    accountId: string,
    projectId: string,
    wallId: string,
  ) => Promise<ProjectWallView>;
  list: (accountId: string, projectId: string) => Promise<ProjectWallSummary[]>;
  moveCards: (
    accountId: string,
    input: MoveProjectWallCardsInput,
  ) => Promise<ProjectWallView>;
  /** Previews the catalog relation of a Visual link; writes nothing. */
  previewPersistentRelation: (
    accountId: string,
    input: PreviewProjectWallPersistentRelationInput,
  ) => Promise<ProjectWallRelationPreview>;
  previewSnapshot: (
    accountId: string,
    input: PreviewProjectWallSnapshotInput,
  ) => Promise<ProjectWallSnapshotPreview>;
  removeCard: (
    accountId: string,
    input: RemoveProjectWallCardInput,
  ) => Promise<ProjectWallView>;
  rename: (
    accountId: string,
    input: RenameProjectWallInput,
  ) => Promise<ProjectWallView>;
  setCardDensity: (
    accountId: string,
    input: SetProjectWallCardDensityInput,
  ) => Promise<ProjectWallView>;
  setCardGroup: (
    accountId: string,
    input: SetProjectWallCardGroupInput,
  ) => Promise<ProjectWallView>;
  setCardHighlight: (
    accountId: string,
    input: SetProjectWallCardHighlightInput,
  ) => Promise<ProjectWallView>;
  setCardLock: (
    accountId: string,
    input: SetProjectWallCardLockInput,
  ) => Promise<ProjectWallView>;
  setFocusOrder: (
    accountId: string,
    input: SetProjectWallFocusOrderInput,
  ) => Promise<ProjectWallView>;
  setGroupCollapsed: (
    accountId: string,
    input: SetProjectWallGroupCollapsedInput,
  ) => Promise<ProjectWallView>;
  sourceOptions: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSourceOption[]>;
  unbindLink: (
    accountId: string,
    input: UnbindProjectWallLinkInput,
  ) => Promise<ProjectWallView>;
}

/** The catalog relation a Visual link would become, shown before any write. */
export interface ProjectWallRelationPreview {
  linkId: string;
  relation: RelationPreview;
}

/** Read-only diagram seam of the Technical Diagrams feature; no write method. */
export interface ProjectWallDiagrams {
  get: TechnicalDiagramsAccess["get"];
  list: TechnicalDiagramsAccess["list"];
  listViews: TechnicalDiagramsAccess["listViews"];
}

/** Read-only seam of the Smart Collections feature; membership stays there. */
export interface ProjectWallCollections {
  getView: SmartCollectionsAccess["getView"];
  listViews: SmartCollectionsAccess["listViews"];
}

/** The only part of the relations seam a wall uses. */
export interface ProjectWallRelations {
  create: (
    accountId: string,
    input: RelationCreateInput,
  ) => Promise<RelationMutationResult>;
  previewCreate: (
    accountId: string,
    input: RelationCreatePreviewInput,
  ) => Promise<RelationPreview>;
}
