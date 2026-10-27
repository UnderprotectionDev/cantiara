// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CLOSURE_SUMMARY_GENERATE_LABEL,
  CLOSURE_SUMMARY_PREVIEW_LABEL,
  CLOSURE_SUMMARY_SELECT_SOURCES_LABEL,
  type ClosureSummarySourceGroup,
} from "@cantiara/api/project-closure-summary";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import {
  type ClosureSummarySelectionForm,
  closureSummarySelectionFormSchema,
  closureSummarySelectionKey,
  toggleClosureSummarySelection,
} from "../../lib/closure-summary-draft";

export type ClosureSummarySourceAction = "generate" | "preview";

/** Source selection: one labelled checkbox group per heading. */
export function ClosureSummarySourceForm({
  groups,
  onSubmitSources,
  pending,
  selected,
}: {
  groups: ClosureSummarySourceGroup[];
  onSubmitSources: (
    selected: string[],
    action: ClosureSummarySourceAction,
  ) => void;
  pending: boolean;
  selected: string[];
}) {
  const idPrefix = useId();
  const form = useForm({
    defaultValues: { selected } as ClosureSummarySelectionForm,
    onSubmit: ({ meta, value }) => {
      const parsed = closureSummarySelectionFormSchema.safeParse(value);
      if (parsed.success) {
        onSubmitSources(parsed.data.selected, meta?.action ?? "preview");
      }
    },
    onSubmitMeta: { action: "preview" } as {
      action: ClosureSummarySourceAction;
    },
  });
  return (
    <form
      aria-label={CLOSURE_SUMMARY_SELECT_SOURCES_LABEL}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit({ action: "preview" }).catch(() => undefined);
      }}
    >
      <h4 className="font-medium text-sm">
        {CLOSURE_SUMMARY_SELECT_SOURCES_LABEL}
      </h4>
      <form.Field name="selected">
        {(field) => (
          <div className="space-y-3">
            {groups.map((group) => (
              <fieldset className="space-y-1" key={group.recordType}>
                <legend className="font-medium text-sm">{group.heading}</legend>
                {group.candidates.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No {group.heading} to select.
                  </p>
                ) : (
                  group.candidates.map((candidate) => {
                    const key = closureSummarySelectionKey(candidate);
                    const id = `${idPrefix}-${key}`;
                    return (
                      <div className="flex items-center gap-2" key={key}>
                        <Checkbox
                          checked={field.state.value.includes(key)}
                          id={id}
                          onCheckedChange={(checked) =>
                            field.handleChange(
                              toggleClosureSummarySelection(
                                field.state.value,
                                key,
                                checked,
                              ),
                            )
                          }
                        />
                        <label className="text-sm" htmlFor={id}>
                          {candidate.label}
                        </label>
                      </div>
                    );
                  })
                )}
              </fieldset>
            ))}
          </div>
        )}
      </form.Field>
      <div className="flex gap-2">
        <Button disabled={pending} type="submit" variant="outline">
          {CLOSURE_SUMMARY_PREVIEW_LABEL}
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            form.handleSubmit({ action: "generate" }).catch(() => undefined);
          }}
          type="button"
        >
          {CLOSURE_SUMMARY_GENERATE_LABEL}
        </Button>
      </div>
    </form>
  );
}
