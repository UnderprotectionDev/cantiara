// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind their current Decision selection.
import type {
  DecisionSupersessionGraph,
  DecisionSupersessionSelection,
} from "@cantiara/api/decision-supersession";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

export function SupersessionSelectionForm({
  selection,
  records,
  onPreview,
  onCancel,
}: {
  selection: DecisionSupersessionSelection;
  records: DecisionSupersessionGraph["records"];
  onPreview: (selection: DecisionSupersessionSelection) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { predecessorIds: selection.predecessorIds, rationale: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        await onPreview({
          ...selection,
          predecessorIds: value.predecessorIds,
          rationale: value.rationale.trim() || null,
        });
      } catch {
        setError(
          "Decisions changed or are unavailable. Review your selection and try again.",
        );
      }
    },
  });
  return (
    <form
      className="space-y-4 rounded-lg border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">
        {selection.operation === "supersede"
          ? "Supersede another decision"
          : "Remove supersession"}
      </h3>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="predecessorIds">
              {(field) => (
                <fieldset className="space-y-2" disabled={pending}>
                  <legend>Decisions to supersede</legend>
                  {records
                    .filter((record) =>
                      selection.operation === "remove"
                        ? selection.predecessorIds.includes(record.id)
                        : record.life === "Valid" &&
                          record.id !== selection.successorId,
                    )
                    .map((record) => (
                      <label
                        className="flex min-h-11 items-center gap-3 break-words"
                        htmlFor={`supersession-predecessor-${record.id}`}
                        key={record.id}
                      >
                        <Checkbox
                          checked={field.state.value.includes(record.id)}
                          disabled={selection.operation === "remove"}
                          id={`supersession-predecessor-${record.id}`}
                          onCheckedChange={(checked) =>
                            field.handleChange(
                              checked
                                ? [...field.state.value, record.id]
                                : field.state.value.filter(
                                    (id) => id !== record.id,
                                  ),
                            )
                          }
                        />
                        {record.title}
                      </label>
                    ))}
                </fieldset>
              )}
            </form.Field>
            <form.Field name="rationale">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="supersession-rationale">
                    Transition rationale (optional)
                  </label>
                  <Textarea
                    disabled={pending}
                    id="supersession-rationale"
                    maxLength={20_000}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              {pending ? "Loading…" : "Preview"}
            </Button>
            <Button
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
