import { z } from "zod";

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

// --- Stored records ---------------------------------------------------------

export interface ProjectWallItemRecord {
  density: ProjectWallDensity;
  highlight: ProjectWallHighlight | null;
  id: string;
  placedAt: string;
  position: ProjectWallPosition;
  sourceId: string;
  sourceType: ProjectWallSourceType;
}

export interface ProjectWallRecord {
  createdAt: string;
  id: string;
  items: ProjectWallItemRecord[];
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
  highlight: ProjectWallHighlight | null;
  id: string;
  placedAt: string;
  position: ProjectWallPosition;
  /** The live master record: `source.recordId` is the source id itself. */
  source: RecordReferenceView;
  sourceType: ProjectWallSourceType;
}

export interface ProjectWallView {
  cards: ProjectWallCardView[];
  createdAt: string;
  id: string;
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
        highlight: item.highlight,
        id: item.id,
        placedAt: item.placedAt,
        position: item.position,
        source,
        sourceType: item.sourceType,
      };
    }),
    createdAt: record.createdAt,
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    updatedAt: record.updatedAt,
  };
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
  createWall: (
    accountId: string,
    input: { id: string; projectId: string; title: string },
  ) => Promise<ProjectWallRecord | null>;
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
  setCardHighlight: (
    accountId: string,
    input: {
      cardId: string;
      highlight: ProjectWallHighlight | null;
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
  delete: (
    accountId: string,
    projectId: string,
    wallId: string,
  ) => Promise<void>;
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
  setCardHighlight: (
    accountId: string,
    input: SetProjectWallCardHighlightInput,
  ) => Promise<ProjectWallView>;
  sourceOptions: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectWallSourceOption[]>;
}
