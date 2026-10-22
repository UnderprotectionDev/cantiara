import { roadmapHorizonSchema } from "@cantiara/api/roadmap-horizon";
import { z } from "zod";

/** `Place on plan` form: a chosen Horizon, or a non-empty planned date for the selected field. */
export const roadmapPlacementFormSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("horizon"), value: roadmapHorizonSchema }),
  z.object({
    field: z.enum(["plannedStartDate", "targetDate"]),
    value: z.string().min(1),
  }),
]);
