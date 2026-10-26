import {
  projectActivityEventTypeSchema,
  projectActivitySourceTypeSchema,
} from "@cantiara/api/project-activity";
import { z } from "zod";

/** The filter form's value: closed sets only, empty means no narrowing. */
export const projectActivityFiltersSchema = z.object({
  eventTypes: z.array(projectActivityEventTypeSchema),
  sourceTypes: z.array(projectActivitySourceTypeSchema),
});
export type ProjectActivityFilters = z.infer<
  typeof projectActivityFiltersSchema
>;

export const NO_PROJECT_ACTIVITY_FILTERS: ProjectActivityFilters = {
  eventTypes: [],
  sourceTypes: [],
};

/** Toggles one member of a filter set without mutating the previous value. */
export function toggleFilterValue<T extends string>(
  values: readonly T[],
  value: T,
  checked: boolean,
): T[] {
  const without = values.filter((entry) => entry !== value);
  return checked ? [...without, value] : without;
}
