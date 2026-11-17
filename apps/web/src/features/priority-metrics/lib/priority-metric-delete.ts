import { z } from "zod";

/** Form schema for Permanently Delete: the typed value must be the Project name. */
export function priorityMetricPermanentDeleteFormSchema(projectName: string) {
  return z.object({
    typedProjectName: z
      .string()
      .trim()
      .refine((value) => value === projectName),
  });
}
