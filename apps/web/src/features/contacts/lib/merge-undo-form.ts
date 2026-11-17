import { mergeUndoResolutionSchema } from "@cantiara/api/contacts";
import { z } from "zod";

/**
 * Form schema for Confirm Undo Merge: a changed field needs an answer, an
 * unchanged merge carries none.
 */
export function mergeUndoFormSchema(conflicted: boolean) {
  return z.object({
    resolution: conflicted
      ? mergeUndoResolutionSchema
      : z.union([mergeUndoResolutionSchema, z.literal("")]),
  });
}
