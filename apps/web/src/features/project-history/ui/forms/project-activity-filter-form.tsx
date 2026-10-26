// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  PROJECT_ACTIVITY_EVENT_TYPES,
  PROJECT_ACTIVITY_SOURCE_TYPES,
} from "@cantiara/api/project-activity";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import {
  NO_PROJECT_ACTIVITY_FILTERS,
  type ProjectActivityFilters,
  projectActivityFiltersSchema,
  toggleFilterValue,
} from "../../lib/project-activity-filters";

/** Filters by source or system type and by event type; applied on submit. */
export function ProjectActivityFilterForm({
  filters,
  onApply,
}: {
  filters: ProjectActivityFilters;
  onApply: (filters: ProjectActivityFilters) => void;
}) {
  const idPrefix = useId();
  const form = useForm({
    defaultValues: filters,
    onSubmit: ({ value }) => {
      const parsed = projectActivityFiltersSchema.safeParse(value);
      if (parsed.success) {
        onApply(parsed.data);
      }
    },
  });
  return (
    <form
      aria-label="Filter Project Activity"
      className="space-y-3"
      onReset={(event) => {
        event.preventDefault();
        form.reset(NO_PROJECT_ACTIVITY_FILTERS);
        onApply(NO_PROJECT_ACTIVITY_FILTERS);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="flex flex-wrap gap-6">
        <form.Field name="sourceTypes">
          {(field) => (
            <fieldset className="space-y-1">
              <legend className="font-medium text-sm">Source type</legend>
              {PROJECT_ACTIVITY_SOURCE_TYPES.map((sourceType) => (
                <div className="flex items-center gap-2" key={sourceType}>
                  <Checkbox
                    checked={field.state.value.includes(sourceType)}
                    id={`${idPrefix}-source-${sourceType}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(
                        toggleFilterValue(
                          field.state.value,
                          sourceType,
                          checked,
                        ),
                      )
                    }
                  />
                  <label
                    className="text-sm"
                    htmlFor={`${idPrefix}-source-${sourceType}`}
                  >
                    {sourceType}
                  </label>
                </div>
              ))}
            </fieldset>
          )}
        </form.Field>
        <form.Field name="eventTypes">
          {(field) => (
            <fieldset className="space-y-1">
              <legend className="font-medium text-sm">Event type</legend>
              {PROJECT_ACTIVITY_EVENT_TYPES.map((eventType) => (
                <div className="flex items-center gap-2" key={eventType}>
                  <Checkbox
                    checked={field.state.value.includes(eventType)}
                    id={`${idPrefix}-event-${eventType}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(
                        toggleFilterValue(
                          field.state.value,
                          eventType,
                          checked,
                        ),
                      )
                    }
                  />
                  <label
                    className="text-sm"
                    htmlFor={`${idPrefix}-event-${eventType}`}
                  >
                    {eventType}
                  </label>
                </div>
              ))}
            </fieldset>
          )}
        </form.Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Apply filters</Button>
        <Button type="reset" variant="outline">
          Clear filters
        </Button>
      </div>
    </form>
  );
}
