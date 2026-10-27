// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CLOSURE_SUMMARY_DISCARD_LABEL,
  CLOSURE_SUMMARY_DRAFT_LABEL,
} from "@cantiara/api/project-closure-summary";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

/**
 * The editable draft. It keeps its text in the form only; there is no save,
 * so closing or discarding leaves no record.
 */
export function ClosureSummaryEditorForm({
  markdown,
  onDiscard,
}: {
  markdown: string;
  onDiscard: () => void;
}) {
  const id = useId();
  const form = useForm({ defaultValues: { markdown } });
  return (
    <form
      aria-label={CLOSURE_SUMMARY_DRAFT_LABEL}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <form.Field name="markdown">
        {(field) => (
          <div className="space-y-1">
            <label className="font-medium text-sm" htmlFor={id}>
              {CLOSURE_SUMMARY_DRAFT_LABEL}
            </label>
            <Textarea
              className="min-h-48 font-mono"
              id={id}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <Button onClick={onDiscard} type="button" variant="outline">
        {CLOSURE_SUMMARY_DISCARD_LABEL}
      </Button>
    </form>
  );
}
