import {
  type ProjectWallSourceOption,
  projectWallTitleSchema,
} from "@cantiara/api/project-wall";
import { previewProjectWallSnapshotInputSchema } from "@cantiara/api/project-wall-presentation";
import { z } from "zod";

const wallTitle = projectWallTitleSchema;

/** `Create Project Wall` form: the name is trimmed and must not be empty. */
export const createProjectWallFormSchema = z.object({ title: wallTitle });

/** `Rename Project Wall` form: the name is trimmed and must not be empty. */
export const renameProjectWallFormSchema = z.object({ title: wallTitle });

/** `Place live card` form: a source record must be selected. */
export const placeProjectWallCardFormSchema = z.object({
  selected: z.string().min(1),
});

/** Key of one `Place live card` source option, unique per record and Diagram View. */
export function optionKey(
  option: Pick<ProjectWallSourceOption, "diagramViewId" | "id" | "sourceType">,
) {
  return `${option.sourceType}:${option.id}${option.diagramViewId ? `:${option.diagramViewId}` : ""}`;
}

/**
 * `Snapshot` form: one group, or else a region of selected cards. Its output
 * is the Snapshot preview and export scope.
 */
export const snapshotScopeFormSchema = z
  .object({
    cardIds: z.array(z.string()),
    groupId: z.string(),
  })
  .transform((value, context) => {
    if (value.groupId) {
      return { groupId: value.groupId };
    }
    const cardIds =
      previewProjectWallSnapshotInputSchema.shape.cardIds.safeParse(
        value.cardIds,
      );
    if (!cardIds.success) {
      // The Snapshot controls stay disabled until a group or cards are chosen.
      context.addIssue({ code: "custom" });
      return z.NEVER;
    }
    return { cardIds: cardIds.data as string[] };
  });
