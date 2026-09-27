import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workTypeSchema } from "./work-lifecycle";

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
export const roadmapViewSchema = roadmapViewFieldsSchema.refine(
  distinctViewFields,
  {
    message: "Group and mark must use different fields.",
  },
);
export type RoadmapView = z.infer<typeof roadmapViewSchema>;

export const saveRoadmapViewInputSchema = roadmapViewFieldsSchema
  .omit({ id: true })
  .extend({ id: identifier.optional() })
  .strict()
  .refine(distinctViewFields, {
    message: "Group and mark must use different fields.",
  });
export const projectRoadmapInputSchema = z
  .object({ projectId: identifier })
  .strict();

export interface RoadmapHorizonAccess {
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

export interface RoadmapWork {
  horizon: RoadmapHorizon | null;
  id: string;
  originResearchIds: readonly string[];
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
