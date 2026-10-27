// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CLOSURE_SUMMARY_DATE_HISTORY_LABEL,
  CLOSURE_SUMMARY_DISCARD_LABEL,
  CLOSURE_SUMMARY_DRAFT_LABEL,
  CLOSURE_SUMMARY_SAVE_LABEL,
  PROJECT_CLOSURE_SUMMARY_LABEL,
} from "@cantiara/api/project-closure-summary";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { z } from "zod";

const saveFormSchema = z.object({
  markdown: z.string().max(1_000_000),
  title: z.string().trim().min(1).max(255),
});

/**
 * The editable draft. It keeps its text in the form until the founder presses
 * `Save as Document`; closing or discarding it before that leaves no record.
 */
export function ClosureSummaryEditorForm({
  hasDateSources,
  markdown,
  onDateHistory,
  onDiscard,
  onSave,
  pending,
}: {
  hasDateSources: boolean;
  markdown: string;
  onDateHistory: () => void;
  onDiscard: () => void;
  onSave: (value: { markdown: string; title: string }) => void;
  pending: boolean;
}) {
  const id = useId();
  const form = useForm({
    defaultValues: {
      markdown,
      title: PROJECT_CLOSURE_SUMMARY_LABEL as string,
    },
    onSubmit: ({ value }) => {
      const parsed = saveFormSchema.safeParse(value);
      if (parsed.success) {
        onSave(parsed.data);
      }
    },
  });
  return (
    <form
      aria-label={CLOSURE_SUMMARY_DRAFT_LABEL}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <div className="space-y-1">
            <label className="font-medium text-sm" htmlFor={`${id}-title`}>
              Title
            </label>
            <Input
              id={`${id}-title`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
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
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} type="submit">
          {CLOSURE_SUMMARY_SAVE_LABEL}
        </Button>
        {hasDateSources ? (
          <Button onClick={onDateHistory} type="button" variant="outline">
            {CLOSURE_SUMMARY_DATE_HISTORY_LABEL}
          </Button>
        ) : null}
        <Button onClick={onDiscard} type="button" variant="outline">
          {CLOSURE_SUMMARY_DISCARD_LABEL}
        </Button>
      </div>
    </form>
  );
}
