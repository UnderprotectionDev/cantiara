import {
  type RelationCreatePreviewInput,
  relationCreatePreviewInputSchema,
  resolveBlockerInputSchema,
} from "@cantiara/api/relations";
import { z } from "zod";

export const RELATION_SELECTION_OPTIONS = [
  "Related",
  "Origin",
  "Blocks",
  "Blocked by",
] as const;
export type RelationSelectionKind = (typeof RELATION_SELECTION_OPTIONS)[number];

function relationPreviewInput(
  selection: RelationSelectionKind,
  workId: string,
  selectedWorkId: string,
): RelationCreatePreviewInput {
  const workIsTarget = selection === "Blocked by";
  return {
    kind: workIsTarget ? "Blocks" : selection,
    source: {
      recordId: workIsTarget ? selectedWorkId : workId,
      recordType: "Work",
    },
    target: {
      recordId: workIsTarget ? workId : selectedWorkId,
      recordType: "Work",
    },
  };
}

/**
 * `Create Persistent Relation` form of one Work. Its output is the relation
 * preview command input; "Blocked by" swaps source and target of a Blocks relation.
 */
export function createRelationFormSchema(workId: string) {
  return z
    .object({
      relationKind: z.enum(RELATION_SELECTION_OPTIONS),
      targetWorkId: z.string().min(1),
    })
    .transform((value) =>
      relationPreviewInput(value.relationKind, workId, value.targetWorkId),
    )
    .pipe(relationCreatePreviewInputSchema);
}

/** `Mark blocker resolved` form: the optional note uses the contract's note rule. */
export const resolveBlockerFormSchema = z.object({
  note: resolveBlockerInputSchema.shape.note,
});
