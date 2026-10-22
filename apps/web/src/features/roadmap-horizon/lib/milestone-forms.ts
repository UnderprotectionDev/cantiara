import { milestoneSchema } from "@cantiara/api/roadmap-horizon";
import { z } from "zod";

/** Milestone create and edit form: a title, an optional calendar date and description. */
export const milestoneFormSchema = z.object({
  description: milestoneSchema.shape.description.unwrap(),
  targetDate: z.literal("").or(milestoneSchema.shape.targetDate.unwrap()),
  title: milestoneSchema.shape.title,
});

/** `Preview relation` form of one Milestone: the Work that contributes to it. */
export const milestoneWorkRelationFormSchema = z.object({
  workId: z.string().min(1),
});
