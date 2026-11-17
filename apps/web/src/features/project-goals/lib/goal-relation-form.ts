import { z } from "zod";

/** Form schema for adding a Project Goal relation: a kind and a chosen Record. */
export const goalRelationFormSchema = z.object({
  kind: z.enum(["Contributes to Goal", "Related"]),
  selection: z.string().min(1),
});
