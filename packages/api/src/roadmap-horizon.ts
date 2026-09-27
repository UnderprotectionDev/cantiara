import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { type WorkProfile, workTypeSchema } from "./work-lifecycle";

const identifier = z.string().trim().min(1).max(255);

export const roadmapHorizonSchema = z.enum(["Now", "Next", "Later"]);
export type RoadmapHorizon = z.infer<typeof roadmapHorizonSchema>;

export const updateWorkHorizonInputSchema = humanMutationEnvelopeSchema
  .extend({ horizon: roadmapHorizonSchema.nullable(), workId: identifier })
  .strict();

const researchDirectionText = z.string().trim().max(2000).nullable();
export const updateResearchDirectionInputSchema = humanMutationEnvelopeSchema
  .extend({
    expectedOutcome: researchDirectionText,
    problemOpportunity: researchDirectionText,
    workId: identifier,
  })
  .strict();

const roadmapViewFieldsSchema = z
  .object({
    groupBy: z.enum(["Horizon", "Type", "Status"]),
    horizons: z.array(roadmapHorizonSchema),
    id: identifier,
    markBy: z.enum(["Horizon", "Type", "Status"]),
    name: z.string().trim().min(1).max(100),
    projectId: identifier,
    types: z.array(workTypeSchema),
  })
  .strict();
const distinctViewFields = (view: { groupBy: string; markBy: string }) =>
  view.groupBy !== view.markBy;
export const roadmapViewSchema = roadmapViewFieldsSchema
  .extend({ revision: z.number().int().nonnegative().safe() })
  .refine(distinctViewFields, {
    message: "Group and mark must use different fields.",
  });
export type RoadmapView = z.infer<typeof roadmapViewSchema>;

export const saveRoadmapViewInputSchema = humanMutationEnvelopeSchema
  .extend(roadmapViewFieldsSchema.shape)
  .strict()
  .refine(distinctViewFields, {
    message: "Group and mark must use different fields.",
  });
export const projectRoadmapInputSchema = z
  .object({ projectId: identifier })
  .strict();

export interface RoadmapHorizonAccess {
  listActiveBlockers: (
    accountId: string,
    projectId: string,
  ) => Promise<RoadmapBlocker[] | null>;
  listOrigins: (
    accountId: string,
    projectId: string,
  ) => Promise<Array<{
    sourceResearchId: string;
    targetFeatureId: string;
  }> | null>;
  listViews: (
    accountId: string,
    projectId: string,
  ) => Promise<RoadmapView[] | null>;
  saveView: (
    accountId: string,
    input: z.input<typeof saveRoadmapViewInputSchema>,
  ) => Promise<RoadmapView | null>;
}

export interface RoadmapOriginLink {
  sourceResearchId: string;
  targetFeatureId: string;
}

export type RoadmapBlockerSource = Pick<
  WorkProfile,
  "archivedAt" | "id" | "key" | "projectId" | "status" | "title" | "type"
>;

export interface RoadmapBlocker {
  blockedWorkId: string;
  blocker: RoadmapBlockerSource;
}

export type RoadmapPlacementChoice =
  | { field: "horizon"; value: RoadmapHorizon }
  | { field: "plannedStartDate" | "targetDate"; value: string };

export interface RoadmapPlacementPreview {
  fieldLabel: "Horizon" | "Planned start date" | "Target date";
  nextValue: string;
  previousValue: string;
}

export function createRoadmapPlacementPreview(
  work: Pick<RoadmapWork, "horizon" | "plannedStartDate" | "targetDate">,
  placement: RoadmapPlacementChoice,
): RoadmapPlacementPreview {
  switch (placement.field) {
    case "horizon":
      return {
        fieldLabel: "Horizon",
        nextValue: placement.value,
        previousValue: work.horizon ?? "No horizon",
      };
    case "plannedStartDate":
      return {
        fieldLabel: "Planned start date",
        nextValue: placement.value,
        previousValue: work.plannedStartDate ?? "No date",
      };
    case "targetDate":
      return {
        fieldLabel: "Target date",
        nextValue: placement.value,
        previousValue: work.targetDate ?? "No date",
      };
    default:
      throw new Error("Unsupported Roadmap placement field.");
  }
}

export interface RoadmapWork {
  horizon: RoadmapHorizon | null;
  id: string;
  originResearchIds: readonly string[];
  plannedStartDate?: string | null;
  targetDate?: string | null;
  title: string;
  type: string;
}

export function presentRoadmap<T extends RoadmapWork>(
  works: readonly T[],
  view: RoadmapView | null,
): Array<{ work: T; secondary: boolean }> {
  const researchIds = new Set(
    works.filter((work) => work.type === "Research").map((work) => work.id),
  );
  return works
    .flatMap((work) => {
      if (view) {
        if (
          view.types.length &&
          !view.types.includes(work.type as (typeof view.types)[number])
        ) {
          return [];
        }
        if (
          view.horizons.length &&
          !(work.horizon && view.horizons.includes(work.horizon))
        ) {
          return [];
        }
        return [{ work, secondary: false }];
      }
      if (work.type === "Research") {
        return [{ work, secondary: false }];
      }
      if (
        work.type === "Feature" &&
        work.originResearchIds.some((id) => researchIds.has(id))
      ) {
        return [{ work, secondary: true }];
      }
      return [];
    })
    .sort((left, right) => Number(left.secondary) - Number(right.secondary));
}

export function listUnplannedRoadmapCandidates<T extends RoadmapWork>(
  works: readonly T[],
  view: RoadmapView | null,
): Array<{ work: T; secondary: boolean }> {
  return presentRoadmap(works, view).filter(
    ({ work }) =>
      work.horizon === null &&
      (work.plannedStartDate === null || work.plannedStartDate === undefined) &&
      (work.targetDate === null || work.targetDate === undefined),
  );
}
