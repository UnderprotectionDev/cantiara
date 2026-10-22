import type { ProjectWallSourceOption } from "@cantiara/api/project-wall";
import { z } from "zod";

const wallTitle = z.string().trim().min(1);

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
