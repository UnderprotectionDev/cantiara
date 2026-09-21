import { z } from "zod";

import type { MutationContract } from "./mutation-and-undo";
import {
  cloneWorkContextLayouts,
  getDefaultWorkContextLayouts,
  normalizeWorkContextLayout,
  repairWorkContextLayouts,
  type WorkContextLayouts,
  workContextLayoutSchema,
} from "./work-context";
import { workTypeSchema } from "./work-lifecycle";

export const STARTER_CONFIGURATION_OPTIONS = [
  "Blank Project",
  "Solo SaaS",
  "Open Source Library",
  "Mobile Application",
] as const;

export type StarterConfiguration =
  (typeof STARTER_CONFIGURATION_OPTIONS)[number];

export const starterConfigurationSchema = z.enum(STARTER_CONFIGURATION_OPTIONS);

export const STARTER_SKELETON_OPTIONS = [
  "Sitemap",
  "Customer Journey",
  "Persona",
  "Retrospective",
  "Launch Plan",
] as const;

export type StarterSkeleton = (typeof STARTER_SKELETON_OPTIONS)[number];

export const STARTER_SKELETON_SURFACE_OPTIONS = [
  "Project Wall",
  "Document",
] as const;

export type StarterSkeletonSurface =
  (typeof STARTER_SKELETON_SURFACE_OPTIONS)[number];

export interface StarterSkeletonSelection {
  emptyHeadings: readonly string[];
  skeleton: StarterSkeleton;
  surface: StarterSkeletonSurface;
}

const STARTER_SKELETON_CATALOG = [
  {
    emptyHeadings: [
      "Primary Navigation",
      "Secondary Navigation",
      "Utility",
      "External",
    ],
    skeleton: "Sitemap",
    surface: "Project Wall",
  },
  {
    emptyHeadings: [
      "Awareness",
      "Consideration",
      "Onboarding",
      "Core Use",
      "Retention",
    ],
    skeleton: "Customer Journey",
    surface: "Project Wall",
  },
  {
    emptyHeadings: [
      "Context",
      "Goals",
      "Behaviors",
      "Pain Points",
      "Constraints",
      "Evidence",
      "Open Questions",
    ],
    skeleton: "Persona",
    surface: "Document",
  },
  {
    emptyHeadings: [
      "Period",
      "What worked?",
      "What did not?",
      "What did we learn?",
      "Decisions",
      "Next changes",
      "Related records",
    ],
    skeleton: "Retrospective",
    surface: "Document",
  },
  {
    emptyHeadings: [
      "Release",
      "Audience",
      "Scope",
      "Readiness",
      "Communication",
      "Launch steps",
      "Risks",
      "Observation plan",
      "Related records",
    ],
    skeleton: "Launch Plan",
    surface: "Document",
  },
] as const satisfies readonly StarterSkeletonSelection[];

function cloneStarterSkeletons(
  skeletons: readonly StarterSkeletonSelection[],
): StarterSkeletonSelection[] {
  return skeletons.map((selection) => ({
    emptyHeadings: [...selection.emptyHeadings],
    skeleton: selection.skeleton,
    surface: selection.surface,
  }));
}

export const PROJECT_AREA_OPTIONS = [
  "Work",
  "Documents",
  "Discovery",
  "Decisions",
  "Design",
  "Technical Diagrams",
  "Tests",
  "Releases",
  "Production",
  "GitHub",
] as const;

export type ProjectArea = (typeof PROJECT_AREA_OPTIONS)[number];

export const PROJECT_CORE_AREA_OPTIONS = ["Work", "Documents"] as const;

export function isProjectCoreArea(area: ProjectArea) {
  return PROJECT_CORE_AREA_OPTIONS.some((coreArea) => coreArea === area);
}

export const PROJECT_WORK_VIEW_OPTIONS = [
  "Backlog",
  "Board",
  "Roadmap",
] as const;

export type ProjectWorkView = (typeof PROJECT_WORK_VIEW_OPTIONS)[number];

export const PROTECTED_WORK_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Closed",
] as const;

export type ProtectedWorkStatus =
  (typeof PROTECTED_WORK_STATUS_OPTIONS)[number];

export const PROJECT_STAGE_STATUS_OPTIONS = [
  "Not Planned",
  "Ready",
  "Active",
  "Completed",
  "Abandoned",
] as const;

export type ProjectStageStatus = (typeof PROJECT_STAGE_STATUS_OPTIONS)[number];

export const projectStageStatusSchema = z.enum(PROJECT_STAGE_STATUS_OPTIONS);

export const projectStageNameSchema = z
  .string()
  .trim()
  .min(1, "Stage name is required.")
  .max(200, "Stage name must be 200 characters or fewer.");

export interface ProjectStage {
  id: string;
  name: string;
  status: ProjectStageStatus;
}

export interface WorkStatusLabel {
  label: string;
  semantic: ProtectedWorkStatus;
}

export const projectAreaSchema = z.enum(PROJECT_AREA_OPTIONS);
const projectWorkViewSchema = z.enum(PROJECT_WORK_VIEW_OPTIONS);
const protectedWorkStatusSchema = z.enum(PROTECTED_WORK_STATUS_OPTIONS);
const protectedWorkStatusesSchema = z
  .array(protectedWorkStatusSchema)
  .length(PROTECTED_WORK_STATUS_OPTIONS.length)
  .refine(
    (statuses) =>
      statuses.every(
        (status, index) => status === PROTECTED_WORK_STATUS_OPTIONS[index],
      ),
    "Work statuses must use the protected status catalog.",
  );
const projectStageSchema = z
  .object({
    id: z.string().trim().min(1).max(255),
    name: projectStageNameSchema,
    status: projectStageStatusSchema,
  })
  .strict();
const projectStagesSchema = z
  .array(projectStageSchema)
  .superRefine((stages, context) => {
    const ids = new Set<string>();
    for (const [index, stage] of stages.entries()) {
      if (ids.has(stage.id)) {
        context.addIssue({
          code: "custom",
          message: "Project stage ids must be unique.",
          path: [index, "id"],
        });
      }
      ids.add(stage.id);
    }
  });
const workStatusLabelsSchema = z
  .array(
    z
      .object({
        label: z.string().trim().min(1).max(200),
        semantic: protectedWorkStatusSchema,
      })
      .strict(),
  )
  .length(PROTECTED_WORK_STATUS_OPTIONS.length)
  .refine(
    (labels) =>
      labels.every(
        (status, index) =>
          status.semantic === PROTECTED_WORK_STATUS_OPTIONS[index],
      ),
    "Work status labels must preserve the protected status semantics.",
  );

function stageIdForName(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `starter-${slug || "stage"}-${index + 1}`;
}

function preparedStagesFromNames(names: readonly string[]): ProjectStage[] {
  return names.map((name, index) => ({
    id: stageIdForName(name, index),
    name,
    status: "Not Planned",
  }));
}

function clonePreparedStages(stages: readonly ProjectStage[]): ProjectStage[] {
  return stages.map((stage) => ({ ...stage }));
}

function defaultWorkStatusLabels(): WorkStatusLabel[] {
  return PROTECTED_WORK_STATUS_OPTIONS.map((semantic) => ({
    label: semantic,
    semantic,
  }));
}

function cloneWorkStatusLabels(
  labels: readonly WorkStatusLabel[],
): WorkStatusLabel[] {
  return labels.map((status) => ({ ...status }));
}

const starterSkeletonSchema = z.enum(STARTER_SKELETON_OPTIONS);
const starterSkeletonSurfaceSchema = z.enum(STARTER_SKELETON_SURFACE_OPTIONS);
const starterSkeletonSelectionSchema = z
  .object({
    emptyHeadings: z.array(z.string().trim().min(1)),
    skeleton: starterSkeletonSchema,
    surface: starterSkeletonSurfaceSchema,
  })
  .strict();

function starterSkeletonsEqual(
  actual: readonly StarterSkeletonSelection[],
  expected: readonly StarterSkeletonSelection[],
) {
  return (
    actual.length === expected.length &&
    actual.every((selection, index) => {
      const expectedSelection = expected[index];
      return (
        selection.skeleton === expectedSelection?.skeleton &&
        selection.surface === expectedSelection?.surface &&
        selection.emptyHeadings.length ===
          expectedSelection.emptyHeadings.length &&
        selection.emptyHeadings.every(
          (heading, headingIndex) =>
            heading === expectedSelection.emptyHeadings[headingIndex],
        )
      );
    })
  );
}

const starterSkeletonsSchema = z
  .array(starterSkeletonSelectionSchema)
  .refine(
    (skeletons) =>
      skeletons.length === 0 ||
      starterSkeletonsEqual(skeletons, STARTER_SKELETON_CATALOG),
    "Starter skeletons must use the closed catalog.",
  );

export interface StarterConfigurationDefinition {
  enabledAreas: readonly ProjectArea[];
  extraPinnedAreas: readonly ProjectArea[];
  hiddenAreas: readonly ProjectArea[];
  preparedStages: readonly ProjectStage[];
  preparedWorkViews: readonly ProjectWorkView[];
  starterSkeletons: readonly StarterSkeletonSelection[];
}

const STARTER_CONFIGURATION_DEFINITIONS = {
  "Blank Project": {
    enabledAreas: ["Work", "Documents"],
    extraPinnedAreas: [],
    hiddenAreas: [],
    preparedStages: [],
    preparedWorkViews: ["Backlog", "Board"],
    starterSkeletons: [],
  },
  "Solo SaaS": {
    enabledAreas: PROJECT_AREA_OPTIONS,
    extraPinnedAreas: ["Discovery", "Decisions", "Design", "Tests", "Releases"],
    hiddenAreas: [],
    preparedStages: preparedStagesFromNames([
      "Discovery",
      "Design",
      "Build",
      "Validate",
      "Release",
      "Operate",
    ]),
    preparedWorkViews: PROJECT_WORK_VIEW_OPTIONS,
    starterSkeletons: STARTER_SKELETON_CATALOG,
  },
  "Open Source Library": {
    enabledAreas: [
      "Work",
      "Documents",
      "Decisions",
      "Technical Diagrams",
      "Tests",
      "Releases",
      "GitHub",
    ],
    extraPinnedAreas: ["GitHub", "Tests", "Releases"],
    hiddenAreas: [],
    preparedStages: preparedStagesFromNames([
      "Scope",
      "Build",
      "Validate",
      "Release",
      "Maintain",
    ]),
    preparedWorkViews: PROJECT_WORK_VIEW_OPTIONS,
    starterSkeletons: STARTER_SKELETON_CATALOG,
  },
  "Mobile Application": {
    enabledAreas: PROJECT_AREA_OPTIONS,
    extraPinnedAreas: [
      "Discovery",
      "Design",
      "Tests",
      "Releases",
      "Production",
    ],
    hiddenAreas: [],
    preparedStages: preparedStagesFromNames([
      "Discovery",
      "Design",
      "Build",
      "Validate",
      "Release",
      "Operate",
    ]),
    preparedWorkViews: PROJECT_WORK_VIEW_OPTIONS,
    starterSkeletons: STARTER_SKELETON_CATALOG,
  },
} as const satisfies Record<
  StarterConfiguration,
  StarterConfigurationDefinition
>;

export function getStarterConfigurationDefinition(
  configuration: StarterConfiguration,
): StarterConfigurationDefinition {
  const definition = STARTER_CONFIGURATION_DEFINITIONS[configuration];
  return {
    enabledAreas: [...definition.enabledAreas],
    extraPinnedAreas: [...definition.extraPinnedAreas],
    hiddenAreas: [...definition.hiddenAreas],
    preparedStages: clonePreparedStages(definition.preparedStages),
    preparedWorkViews: [...definition.preparedWorkViews],
    starterSkeletons: cloneStarterSkeletons(definition.starterSkeletons),
  };
}

export interface ProjectShellConfiguration
  extends StarterConfigurationDefinition {
  workContextLayouts: WorkContextLayouts;
  workStatuses: readonly ProtectedWorkStatus[];
  workStatusLabels: readonly WorkStatusLabel[];
}

export const projectShellConfigurationSchema = z
  .object({
    enabledAreas: z.array(projectAreaSchema),
    extraPinnedAreas: z.array(projectAreaSchema),
    hiddenAreas: z.array(projectAreaSchema),
    preparedStages: projectStagesSchema,
    preparedWorkViews: z.array(projectWorkViewSchema),
    starterSkeletons: starterSkeletonsSchema,
    // Work Context Card layouts are repaired on read; storage stays lenient so
    // an evolved prepared section set cannot invalidate the configuration.
    workContextLayouts: z.unknown().optional(),
    workStatuses: protectedWorkStatusesSchema,
    workStatusLabels: workStatusLabelsSchema,
  })
  .strict();

const legacyProjectShellConfigurationSchema = z
  .object({
    enabledAreas: z.array(projectAreaSchema),
    extraPinnedAreas: z.array(projectAreaSchema),
    hiddenAreas: z.array(projectAreaSchema).optional(),
    preparedStages: z.array(
      z.union([z.string().trim().min(1), projectStageSchema]),
    ),
    preparedWorkViews: z.array(projectWorkViewSchema),
    starterSkeletons: starterSkeletonsSchema.optional(),
    workContextLayouts: z.unknown().optional(),
    workStatuses: protectedWorkStatusesSchema,
    workStatusLabels: workStatusLabelsSchema.optional(),
  })
  .strict();

export function getProjectShellConfiguration(
  configuration: StarterConfiguration,
): ProjectShellConfiguration {
  return {
    ...getStarterConfigurationDefinition(configuration),
    workContextLayouts: getDefaultWorkContextLayouts(),
    workStatuses: [...PROTECTED_WORK_STATUS_OPTIONS],
    workStatusLabels: defaultWorkStatusLabels(),
  };
}

function normalizeLegacyStages(
  stages: readonly (string | ProjectStage)[],
): ProjectStage[] {
  return stages.map((stage, index) =>
    typeof stage === "string"
      ? {
          id: stageIdForName(stage, index),
          name: stage,
          status: "Not Planned",
        }
      : { ...stage },
  );
}

function cloneProjectShellConfiguration(
  configuration: ProjectShellConfiguration,
): ProjectShellConfiguration {
  return {
    enabledAreas: [...configuration.enabledAreas],
    extraPinnedAreas: [...configuration.extraPinnedAreas],
    hiddenAreas: [...configuration.hiddenAreas],
    preparedStages: clonePreparedStages(configuration.preparedStages),
    preparedWorkViews: [...configuration.preparedWorkViews],
    starterSkeletons: cloneStarterSkeletons(configuration.starterSkeletons),
    workContextLayouts: cloneWorkContextLayouts(
      configuration.workContextLayouts,
    ),
    workStatuses: [...configuration.workStatuses],
    workStatusLabels: cloneWorkStatusLabels(configuration.workStatusLabels),
  };
}

export function resolveProjectShellConfiguration(
  value: unknown,
  starterConfiguration: StarterConfiguration,
): ProjectShellConfiguration {
  const parsed = projectShellConfigurationSchema.safeParse(value);
  const expected = getProjectShellConfiguration(starterConfiguration);
  if (parsed.success) {
    const resolved: ProjectShellConfiguration = {
      enabledAreas: [...parsed.data.enabledAreas],
      extraPinnedAreas: [...parsed.data.extraPinnedAreas],
      hiddenAreas: [...parsed.data.hiddenAreas],
      preparedStages: clonePreparedStages(parsed.data.preparedStages),
      preparedWorkViews: [...parsed.data.preparedWorkViews],
      starterSkeletons: cloneStarterSkeletons(parsed.data.starterSkeletons),
      workContextLayouts: repairWorkContextLayouts(
        parsed.data.workContextLayouts,
      ),
      workStatuses: [...parsed.data.workStatuses],
      workStatusLabels: cloneWorkStatusLabels(parsed.data.workStatusLabels),
    };
    return starterSkeletonsEqual(
      resolved.starterSkeletons,
      expected.starterSkeletons,
    )
      ? resolved
      : {
          ...resolved,
          starterSkeletons: cloneStarterSkeletons(expected.starterSkeletons),
        };
  }

  const legacy = legacyProjectShellConfigurationSchema.safeParse(value);
  return legacy.success
    ? {
        ...legacy.data,
        hiddenAreas: [...(legacy.data.hiddenAreas ?? [])],
        preparedStages: normalizeLegacyStages(legacy.data.preparedStages),
        starterSkeletons: cloneStarterSkeletons(expected.starterSkeletons),
        workContextLayouts: repairWorkContextLayouts(
          legacy.data.workContextLayouts,
        ),
        workStatusLabels: cloneWorkStatusLabels(
          legacy.data.workStatusLabels ?? defaultWorkStatusLabels(),
        ),
      }
    : expected;
}

export function enableProjectArea(
  configuration: ProjectShellConfiguration,
  area: ProjectArea,
): ProjectShellConfiguration {
  return {
    ...configuration,
    enabledAreas: PROJECT_AREA_OPTIONS.filter(
      (candidate) =>
        candidate === area || configuration.enabledAreas.includes(candidate),
    ),
    extraPinnedAreas: [...configuration.extraPinnedAreas],
    hiddenAreas: [...configuration.hiddenAreas],
    preparedStages: clonePreparedStages(configuration.preparedStages),
    preparedWorkViews: [...configuration.preparedWorkViews],
    starterSkeletons: cloneStarterSkeletons(configuration.starterSkeletons),
    workContextLayouts: cloneWorkContextLayouts(
      configuration.workContextLayouts,
    ),
    workStatuses: [...configuration.workStatuses],
    workStatusLabels: cloneWorkStatusLabels(configuration.workStatusLabels),
  };
}

export const workContextLayoutChangeSchema = z
  .object({
    kind: z.literal("set-work-context-layout"),
    layout: workContextLayoutSchema,
    workType: workTypeSchema,
  })
  .strict();

export const projectShellConfigurationChangeSchema = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        kind: z.literal("add-stage"),
        name: projectStageNameSchema,
        status: projectStageStatusSchema.optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("rename-stage"),
        name: projectStageNameSchema,
        stageId: z.string().trim().min(1).max(255),
      })
      .strict(),
    z
      .object({
        kind: z.literal("set-stage-status"),
        stageId: z.string().trim().min(1).max(255),
        status: projectStageStatusSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("reorder-stages"),
        stageIds: z.array(z.string().trim().min(1).max(255)),
      })
      .strict(),
    z
      .object({
        kind: z.literal("remove-stage"),
        stageId: z.string().trim().min(1).max(255),
      })
      .strict(),
    z
      .object({
        area: projectAreaSchema,
        kind: z.literal("set-area-visibility"),
        visible: z.boolean(),
      })
      .strict(),
    z
      .object({
        area: projectAreaSchema,
        kind: z.literal("pin-area"),
      })
      .strict(),
    z
      .object({
        area: projectAreaSchema,
        kind: z.literal("unpin-area"),
      })
      .strict(),
    z
      .object({
        areas: z.array(projectAreaSchema),
        kind: z.literal("reorder-pinned-areas"),
      })
      .strict(),
    z.object({ kind: z.literal("restore-default-navigation") }).strict(),
    z
      .object({
        kind: z.literal("rename-work-status"),
        label: z.string().trim().min(1).max(200),
        semantic: protectedWorkStatusSchema,
      })
      .strict(),
    workContextLayoutChangeSchema,
  ],
);

export type ProjectShellConfigurationChange = z.input<
  typeof projectShellConfigurationChangeSchema
>;

export const updateProjectConfigurationInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    change: projectShellConfigurationChangeSchema,
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1),
  })
  .strict();

export type UpdateProjectConfigurationInput = z.input<
  typeof updateProjectConfigurationInputSchema
>;

export const previewWorkContextLayoutInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    change: workContextLayoutChangeSchema,
    projectId: z.string().trim().min(1),
  })
  .strict();

export type PreviewWorkContextLayoutInput = z.input<
  typeof previewWorkContextLayoutInputSchema
>;

export const undoWorkContextLayoutInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1),
    receiptId: z.string().trim().min(1).max(255),
  })
  .strict();

export type UndoWorkContextLayoutInput = z.input<
  typeof undoWorkContextLayoutInputSchema
>;

export class ProjectShellConfigurationChangeError extends Error {
  readonly code = "PROJECT_CONFIGURATION_CHANGE_REJECTED" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectShellConfigurationChangeError";
  }
}

function stageIndexOrThrow(stages: readonly ProjectStage[], stageId: string) {
  const index = stages.findIndex((stage) => stage.id === stageId);
  if (index === -1) {
    throw new ProjectShellConfigurationChangeError("Project stage not found.");
  }
  return index;
}

function ensureEnabledArea(
  configuration: ProjectShellConfiguration,
  area: ProjectArea,
) {
  if (!configuration.enabledAreas.includes(area)) {
    throw new ProjectShellConfigurationChangeError(
      "Only an enabled Project area can be hidden or shown.",
    );
  }
}

function reorderedValues<T extends string>(
  current: readonly T[],
  requested: readonly T[],
  label: string,
): T[] {
  if (
    current.length !== requested.length ||
    new Set(current).size !== new Set(requested).size ||
    current.some((value) => !requested.includes(value))
  ) {
    throw new ProjectShellConfigurationChangeError(
      `${label} order must contain the current entries exactly once.`,
    );
  }
  return [...requested];
}

export function applyProjectShellConfigurationChange(
  configuration: ProjectShellConfiguration,
  change: ProjectShellConfigurationChange,
  starterConfiguration: StarterConfiguration,
): ProjectShellConfiguration {
  const parsedChange = projectShellConfigurationChangeSchema.parse(change);
  const next = cloneProjectShellConfiguration(configuration);

  switch (parsedChange.kind) {
    case "add-stage":
      next.preparedStages = [
        ...next.preparedStages,
        {
          id: crypto.randomUUID(),
          name: parsedChange.name,
          status: parsedChange.status ?? "Not Planned",
        },
      ];
      return next;
    case "rename-stage": {
      stageIndexOrThrow(next.preparedStages, parsedChange.stageId);
      next.preparedStages = next.preparedStages.map((stage) =>
        stage.id === parsedChange.stageId
          ? { ...stage, name: parsedChange.name }
          : stage,
      );
      return next;
    }
    case "set-stage-status": {
      stageIndexOrThrow(next.preparedStages, parsedChange.stageId);
      next.preparedStages = next.preparedStages.map((stage) =>
        stage.id === parsedChange.stageId
          ? { ...stage, status: parsedChange.status }
          : stage,
      );
      return next;
    }
    case "reorder-stages":
      next.preparedStages = reorderedValues(
        next.preparedStages.map((stage) => stage.id),
        parsedChange.stageIds,
        "Project stage",
      ).map((stageId) => {
        const stage = next.preparedStages.find(
          (candidate) => candidate.id === stageId,
        );
        if (!stage) {
          throw new ProjectShellConfigurationChangeError(
            "Project stage not found.",
          );
        }
        return stage;
      });
      return next;
    case "remove-stage":
      stageIndexOrThrow(next.preparedStages, parsedChange.stageId);
      next.preparedStages = next.preparedStages.filter(
        (stage) => stage.id !== parsedChange.stageId,
      );
      return next;
    case "set-area-visibility":
      ensureEnabledArea(next, parsedChange.area);
      if (parsedChange.visible) {
        next.hiddenAreas = next.hiddenAreas.filter(
          (area) => area !== parsedChange.area,
        );
      } else if (!next.hiddenAreas.includes(parsedChange.area)) {
        next.hiddenAreas = [...next.hiddenAreas, parsedChange.area];
      }
      return next;
    case "pin-area":
      ensureEnabledArea(next, parsedChange.area);
      if (isProjectCoreArea(parsedChange.area)) {
        throw new ProjectShellConfigurationChangeError(
          "Work and Documents are already in the core Project navigation.",
        );
      }
      next.extraPinnedAreas = next.extraPinnedAreas.includes(parsedChange.area)
        ? next.extraPinnedAreas
        : [...next.extraPinnedAreas, parsedChange.area];
      return next;
    case "unpin-area":
      next.extraPinnedAreas = next.extraPinnedAreas.filter(
        (area) => area !== parsedChange.area,
      );
      return next;
    case "reorder-pinned-areas":
      next.extraPinnedAreas = reorderedValues(
        next.extraPinnedAreas,
        parsedChange.areas,
        "Pinned Project area",
      );
      return next;
    case "restore-default-navigation":
      next.extraPinnedAreas = [
        ...getStarterConfigurationDefinition(starterConfiguration)
          .extraPinnedAreas,
      ];
      return next;
    case "rename-work-status":
      next.workStatusLabels = next.workStatusLabels.map((status) =>
        status.semantic === parsedChange.semantic
          ? { ...status, label: parsedChange.label }
          : status,
      );
      return next;
    case "set-work-context-layout":
      try {
        next.workContextLayouts[parsedChange.workType] =
          normalizeWorkContextLayout(
            parsedChange.workType,
            parsedChange.layout,
          );
      } catch (error) {
        throw new ProjectShellConfigurationChangeError(
          error instanceof Error
            ? error.message
            : "Work Context Card layout is invalid.",
          { cause: error },
        );
      }
      return next;
    default:
      throw new ProjectShellConfigurationChangeError(
        "Unsupported Project configuration change.",
      );
  }
}

export const PROJECT_LIFECYCLE_STATUS_OPTIONS = [
  "Active",
  "Pending",
  "Completed",
  "Abandoned",
] as const;

export type ProjectLifecycleStatus =
  (typeof PROJECT_LIFECYCLE_STATUS_OPTIONS)[number];

export const projectLifecycleStatusSchema = z.enum(
  PROJECT_LIFECYCLE_STATUS_OPTIONS,
);

const FIRST_LETTER_WORD_PATTERN = /[A-Z][A-Z0-9]*/;

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project Name is required.")
  .max(200, "Project Name must be 200 characters or fewer.");

export function normalizeProjectShortCode(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function suggestProjectShortCode(projectName: string) {
  const normalized = normalizeProjectShortCode(projectName);
  const firstLetterWord = normalized.match(FIRST_LETTER_WORD_PATTERN)?.[0];
  return (firstLetterWord || "PROJECT").slice(0, 3);
}

const canonicalShortCodeSchema = z
  .string()
  .min(1, "Short code is required.")
  .max(32, "Short code must be 32 characters or fewer.")
  .regex(
    /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/,
    "Short code must start with a letter and contain only letters, numbers, or hyphens.",
  );

export const shortCodeSchema = z
  .string()
  .trim()
  .min(1, "Short code is required.")
  .max(64, "Short code must be 64 characters or fewer.")
  .transform(normalizeProjectShortCode)
  .pipe(canonicalShortCodeSchema);

const optionalProjectTextSchema = z
  .string()
  .trim()
  .max(10_000)
  .nullable()
  .optional();

const projectLogoSchema = z.union([
  z
    .string()
    .trim()
    .max(1_000_100, "Logo must be 1 MB or smaller.")
    .regex(
      /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Logo must be an uploaded PNG, JPEG, WebP, or GIF image.",
    ),
  z.string().trim().url().max(2000),
]);

const optionalProjectLogoSchema = projectLogoSchema.nullable().optional();

const targetDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must use YYYY-MM-DD.")
  .nullable()
  .optional();

const createProjectInputObjectSchema = z
  .object({
    logo: optionalProjectLogoSchema,
    name: projectNameSchema.optional(),
    problem: optionalProjectTextSchema,
    projectName: projectNameSchema.optional(),
    purpose: optionalProjectTextSchema,
    scope: optionalProjectTextSchema,
    shortCode: shortCodeSchema.optional(),
    starterConfiguration: starterConfigurationSchema,
    targetDate: targetDateSchema,
  })
  .strict();

export const createProjectInputSchema = createProjectInputObjectSchema
  .superRefine((input, context) => {
    if (!(input.name || input.projectName)) {
      context.addIssue({
        code: "custom",
        message: "Project Name is required.",
        path: ["projectName"],
      });
    }

    if (
      input.name &&
      input.projectName &&
      input.name.trim() !== input.projectName.trim()
    ) {
      context.addIssue({
        code: "custom",
        message: "Project Name must be provided only once.",
        path: ["projectName"],
      });
    }
  })
  .transform(({ name, projectName, ...input }) => ({
    ...input,
    name: (name ?? projectName ?? "").trim(),
  }));

const createProjectMutationInputObjectSchema = createProjectInputObjectSchema
  .extend({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
  })
  .strict();

export const createProjectMutationInputSchema =
  createProjectMutationInputObjectSchema
    .superRefine((input, context) => {
      if (!(input.name || input.projectName)) {
        context.addIssue({
          code: "custom",
          message: "Project Name is required.",
          path: ["projectName"],
        });
      }

      if (
        input.name &&
        input.projectName &&
        input.name.trim() !== input.projectName.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "Project Name must be provided only once.",
          path: ["projectName"],
        });
      }
    })
    .transform(({ name, projectName, ...input }) => ({
      ...input,
      name: (name ?? projectName ?? "").trim(),
    }));

export type CreateProjectMutationInput = z.input<
  typeof createProjectMutationInputSchema
>;

export const updateProjectShortCodeInputSchema = z
  .object({
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1),
    shortCode: shortCodeSchema,
  })
  .strict();

export type UpdateProjectShortCodeInput = z.input<
  typeof updateProjectShortCodeInputSchema
>;

export const enableProjectAreaInputSchema = z
  .object({
    area: projectAreaSchema,
    baseRevision: z.number().int().nonnegative().safe(),
    clientIdempotencyKey: z.string().trim().min(1).max(255),
    projectId: z.string().trim().min(1),
  })
  .strict();

export type EnableProjectAreaInput = z.input<
  typeof enableProjectAreaInputSchema
>;

export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type ParsedCreateProjectInput = z.output<
  typeof createProjectInputSchema
>;

export interface ProjectProfile {
  configuration: ProjectShellConfiguration;
  createdAt: string;
  id: string;
  logo: string | null;
  name: string;
  problem: string | null;
  purpose: string | null;
  revision: number;
  scope: string | null;
  shortCode: string;
  shortCodeLocked: boolean;
  starterConfiguration: StarterConfiguration;
  status: ProjectLifecycleStatus;
  targetDate: string | null;
  updatedAt: string;
}

export interface ProjectShellRecord
  extends Omit<ProjectProfile, "shortCodeLocked"> {
  workCount: number;
  workspaceId: string;
}

export type ProjectShellCreateRecord = Omit<
  ProjectShellRecord,
  "createdAt" | "id" | "revision" | "updatedAt" | "workCount" | "workspaceId"
>;

export interface ProjectShellMutationValue {
  project: ProjectProfile | null;
}

export type WorkContextLayoutMutationResult = ProjectProfile & {
  receiptId: string;
};

export type ProjectShellMutationContract =
  MutationContract<ProjectShellMutationValue>;

export interface ProjectShellMutationContracts {
  create: (accountId: string) => ProjectShellMutationContract;
  update: (accountId: string) => ProjectShellMutationContract;
}

export interface ProjectShellAccess {
  create: (
    accountId: string,
    input: CreateProjectInput,
  ) => Promise<ProjectProfile>;
  find: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectProfile | null>;
  list: (accountId: string) => Promise<ProjectProfile[]>;
  recordFirstWork: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectProfile | null>;
  updateShortCode: (
    accountId: string,
    projectId: string,
    shortCode: string,
  ) => Promise<ProjectProfile | null>;
}
