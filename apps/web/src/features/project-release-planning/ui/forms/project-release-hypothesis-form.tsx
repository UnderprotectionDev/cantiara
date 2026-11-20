// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import type { ProjectReleaseRecord } from "@cantiara/api/project-release-planning";
import { PROJECT_RELEASE_HYPOTHESIS_FIELDS } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";
import {
  type ProjectReleaseHypothesis,
  projectReleaseHypothesisDraft,
  projectReleaseHypothesisFormSchema,
} from "../../lib/project-release-planning-form";

/** Edits the five separate, optional access and outcome fields; none is a gate. */
export function ProjectReleaseHypothesisForm({
  onCancel,
  onSave,
  release,
}: {
  onCancel: () => void;
  onSave: (hypothesis: ProjectReleaseHypothesis) => Promise<unknown>;
  release: ProjectReleaseRecord;
}) {
  const form = useForm({
    defaultValues: projectReleaseHypothesisDraft(release),
    onSubmit: async ({ value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = projectReleaseHypothesisFormSchema.safeParse(value);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: { form: "Shorten the text before saving.", fields: {} },
        });
        return;
      }
      try {
        await onSave(parsed.data);
      } catch {
        form.setErrorMap({
          onSubmit: {
            form: "Hypothesis could not be saved. Reload to check for changes; your text is kept here.",
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      aria-label="Edit hypothesis"
      className="space-y-4 rounded-lg border border-border/70 p-4"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            {PROJECT_RELEASE_HYPOTHESIS_FIELDS.map(({ label, name }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <label
                    className="grid gap-2 text-sm"
                    htmlFor={`project-release-${name}`}
                  >
                    {label} (optional)
                    <Textarea
                      disabled={isSubmitting}
                      id={`project-release-${name}`}
                      maxLength={20_000}
                      name={name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                  </label>
                )}
              </form.Field>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
