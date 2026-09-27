import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import { workTypeSchema } from "./work-lifecycle";

const identifier = z.string().trim().min(1).max(255);

export const MILESTONE_STATUS_OPTIONS = [
  "Planned",
  "Reached",
  "Abandoned",
] as const;
export const milestoneStatusSchema = z.enum(MILESTONE_STATUS_OPTIONS);

const milestoneFieldsSchema = z
  .object({
    description: z.string().max(20_000).nullable(),
    id: identifier,
    projectId: identifier,
    status: milestoneStatusSchema,
    targetDate: z.iso.date().nullable(),
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const milestoneSchema = milestoneFieldsSchema
  .extend({ revision: z.number().int().nonnegative().safe() })
  .strict();
export type Milestone = z.infer<typeof milestoneSchema>;

const milestoneMetadataFieldsSchema = milestoneFieldsSchema.pick({
  description: true,
  projectId: true,
  targetDate: true,
  title: true,
});

export const createMilestoneInputSchema = humanMutationEnvelopeSchema
  .extend(milestoneMetadataFieldsSchema.extend({ id: identifier }).shape)
  .strict();
export const updateMilestoneInputSchema = humanMutationEnvelopeSchema
  .extend(
    milestoneMetadataFieldsSchema.extend({ milestoneId: identifier }).shape,
  )
  .strict();
export const updateMilestoneStatusInputSchema = humanMutationEnvelopeSchema
  .extend({
    milestoneId: identifier,
    projectId: identifier,
    status: z.enum(["Reached", "Abandoned"]),
  })
  .strict();

export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>;
export type UpdateMilestoneStatusInput = z.infer<
  typeof updateMilestoneStatusInputSchema
>;

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
  createMilestone: (
    accountId: string,
    input: z.input<typeof createMilestoneInputSchema>,
  ) => Promise<Milestone | null>;
  listMilestones: (
    accountId: string,
    projectId: string,
  ) => Promise<Milestone[] | null>;
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
  updateMilestone: (
    accountId: string,
    input: z.input<typeof updateMilestoneInputSchema>,
  ) => Promise<Milestone | null>;
  updateMilestoneStatus: (
    accountId: string,
    input: z.input<typeof updateMilestoneStatusInputSchema>,
  ) => Promise<Milestone | null>;
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
