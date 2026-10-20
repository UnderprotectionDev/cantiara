import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { getStarterConfigurationDefinition } from "./project-shell";
import {
  type RelationCreateInput,
  type RelationCreatePreviewInput,
  type RelationEndpoint,
  type RelationMutationResult,
  type RelationPreview,
  relationKindSchema,
} from "./relations";
import {
  type RecordLookup,
  type RecordReferenceView,
  recordLookupKey,
  resolveRecordReference,
} from "./user-flow";

const identifierSchema = z.string().trim().min(1).max(255);

/**
 * Master record types a Project Wall card can reference. A card is a live
 * reference to one of these by source id; the wall never stores a copy.
 */
export const PROJECT_WALL_SOURCE_TYPES = ["Work", "Decision", "Risk"] as const;
export const projectWallSourceTypeSchema = z.enum(PROJECT_WALL_SOURCE_TYPES);
export type ProjectWallSourceType = z.infer<typeof projectWallSourceTypeSchema>;

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

/**
 * Starter skeletons the Project shell can select for a Project Wall. The shell
 * records only the selection; this feature materializes the empty headings.
 */
export const PROJECT_WALL_SKELETONS = ["Sitemap", "Customer Journey"] as const;
export const projectWallSkeletonSchema = z.enum(PROJECT_WALL_SKELETONS);
export type ProjectWallSkeleton = z.infer<typeof projectWallSkeletonSchema>;

/** The exact, ordered empty group headings of a skeleton (catalog-owned). */
export function projectWallSkeletonHeadings(
  skeleton: ProjectWallSkeleton,
): string[] {
  const selection = getStarterConfigurationDefinition(
    "Solo SaaS",
  ).starterSkeletons.find((candidate) => candidate.skeleton === skeleton);
  return selection ? [...selection.emptyHeadings] : [];
}

export const createProjectWallFromSkeletonInputSchema = z
  .object({ projectId: identifierSchema, skeleton: projectWallSkeletonSchema })
  .strict();
export type CreateProjectWallFromSkeletonInput = z.input<
  typeof createProjectWallFromSkeletonInputSchema
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
    position: projectWallPositionSchema.default({ x: 0, y: 0 }),
    sourceId: identifierSchema,
    sourceType: projectWallSourceTypeSchema,
  })
  .strict();
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
      title: string;
      trashed?: boolean;
      values: Partial<Record<ProjectWallFieldName, string | null>>;
    }
  | { kind: "inaccessible" };

export interface ProjectWallSourceOption {
  id: string;
  sourceType: ProjectWallSourceType;
  title: string;
}

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
  /** The live master record: `source.recordId` is the source id itself. */
  source: RecordReferenceView;
  sourceType: ProjectWallSourceType;
}

export type ProjectWallGroupView = ProjectWallGroupRecord;

/** A `Visual link`: wall narrative only, never counted as a record relation. */
export type ProjectWallLinkView = ProjectWallLinkRecord;

export interface ProjectWallView {
  cards: ProjectWallCardView[];
  createdAt: string;
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
 * Builds the wall view. Each card resolves its source id through the common
 * broken-reference presentation: a trashed, archived, deleted or inaccessible
 * record is explained and never retargeted. Broken cards show no fields.
 */
export function buildProjectWallView(
  record: ProjectWallRecord,
  lookups: ReadonlyMap<string, ProjectWallSourceLookup>,
): ProjectWallView {
  return {
    cards: record.items.map((item) => {
      const lookup = lookups.get(
        recordLookupKey(item.sourceType, item.sourceId),
      );
      const source = resolveRecordReference({
        flowProjectId: record.projectId,
        kind: item.sourceType,
        lookup: lookup as RecordLookup | undefined,
        placedAt: item.placedAt,
        recordId: item.sourceId,
      });
      return {
        density: item.density,
        fields:
          source.broken?.reason === "Archived" || !source.broken
            ? projectWallCardFields(item.sourceType, item.density, lookup)
            : [],
        groupId: item.groupId,
        highlight: item.highlight,
        id: item.id,
        locked: item.locked,
        placedAt: item.placedAt,
        position: item.position,
        source,
        sourceType: item.sourceType,
      };
    }),
    createdAt: record.createdAt,
    groups: record.groups,
    id: record.id,
    links: record.links,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
  };
}

/** The relation endpoint a card stands for: its live source record. */
export function projectWallCardEndpoint(
  card: Pick<ProjectWallItemRecord, "sourceId" | "sourceType">,
): RelationEndpoint {
  return { recordId: card.sourceId, recordType: card.sourceType };
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
  /** One atomic write of a wall and its empty groups, in the given order. */
  createWallWithGroups: (
    accountId: string,
    input: {
      groups: Array<{ id: string; title: string }>;
      id: string;
      projectId: string;
      title: string;
    },
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
    refs: Array<{ id: string; sourceType: ProjectWallSourceType }>,
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
  /** The Project shell's recorded catalog selection; null when not owned. */
  selectedSkeletons: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSkeleton[] | null>;
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
  /** A normal wall with the skeleton's empty headings; needs the selection. */
  createFromSkeleton: (
    accountId: string,
    input: CreateProjectWallFromSkeletonInput,
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
  setGroupCollapsed: (
    accountId: string,
    input: SetProjectWallGroupCollapsedInput,
  ) => Promise<ProjectWallView>;
  /** Skeletons the Project shell selected for a Project Wall. */
  skeletons: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSkeleton[]>;
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
