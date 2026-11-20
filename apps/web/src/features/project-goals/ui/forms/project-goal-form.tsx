// biome-ignore-all lint/performance/noJsxPropsBind: Goal controls bind to the selected record and form field.

import {
  type ProjectGoalRecord,
  projectGoalFieldsSchema,
} from "@cantiara/api/project-goals";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

export interface ProjectGoalDraft {
  description: string;
  intendedOutcome: string;
  observedOutcomeLearning: string;
  title: string;
}
const EMPTY_DRAFT: ProjectGoalDraft = {
  title: "",
  description: "",
  intendedOutcome: "",
  observedOutcomeLearning: "",
};

export const FIELDS = [
  { name: "title", label: "Title", required: true, maxLength: 255 },
  {
    name: "description",
    label: "Description",
    required: true,
    maxLength: 10_000,
  },
  {
    name: "intendedOutcome",
    label: "Intended outcome",
    required: false,
    maxLength: 10_000,
  },
  {
    name: "observedOutcomeLearning",
    label: "Observed outcome / learning",
    required: false,
    maxLength: 10_000,
  },
] as const;

export class ProjectGoalSaveConflictError extends Error {
  readonly currentValue: ProjectGoalRecord | null;
  constructor(currentValue: ProjectGoalRecord | null, options?: ErrorOptions) {
    super(
      "Conflict. Project Goal changed. Cancel and reopen the editor before saving again. Your text is kept here.",
      options,
    );
    this.currentValue = currentValue;
  }
}

export function ProjectGoalEditor({
  goal,
  onSave,
  onCancel,
}: {
  goal?: ProjectGoalRecord;
  onSave: (
    draft: ProjectGoalDraft,
    baseGoal?: ProjectGoalRecord,
  ) => Promise<unknown>;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      baseGoal: goal,
      ...(goal
        ? {
            title: goal.title,
            description: goal.description,
            intendedOutcome: goal.intendedOutcome ?? "",
            observedOutcomeLearning: goal.observedOutcomeLearning ?? "",
          }
        : EMPTY_DRAFT),
    },
    onSubmit: async ({ value: { baseGoal, ...value } }) => {
      form.setErrorMap({ onSubmit: undefined });
      if (!projectGoalFieldsSchema.safeParse(value).success) {
        form.setErrorMap({
          onSubmit: {
            form: "Enter a Title and Description before saving.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onSave(value, baseGoal);
      } catch (saveError) {
        if (saveError instanceof ProjectGoalSaveConflictError) {
          form.setErrorMap({
            onSubmit: { form: saveError, fields: {} },
          });
          return;
        }
        form.setErrorMap({
          onSubmit: {
            form: "Project Goal could not be saved. Retry, or reload to check for changes. Your text is kept here.",
            fields: {},
          },
        });
      }
    },
  });
  const validation = useSelector(
    form.store,
    (state): unknown => state.errorMap.onSubmit,
  );
  const conflict =
    validation instanceof ProjectGoalSaveConflictError ? validation : null;
  const error =
    conflict?.message ?? (typeof validation === "string" ? validation : null);
  const saveLabel = error && !conflict ? "Retry" : "Save";
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {conflict?.currentValue ? (
        <section
          aria-label="Current value"
          className="space-y-2 rounded-md border p-4"
        >
          <h3 className="font-medium">Current value</h3>
          <ProjectGoalValues goal={conflict.currentValue} />
        </section>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            {FIELDS.map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <label
                    className="grid gap-2 text-sm"
                    htmlFor={`project-goal-${name}`}
                  >
                    {label}
                    {required ? "" : " (optional)"}
                    {name === "title" ? (
                      <Input
                        disabled={isSubmitting}
                        id={`project-goal-${name}`}
                        maxLength={maxLength}
                        name={name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={isSubmitting}
                        id={`project-goal-${name}`}
                        maxLength={maxLength}
                        name={name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    )}
                  </label>
                )}
              </form.Field>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting || !!conflict} type="submit">
                {isSubmitting ? "Saving…" : <span>{saveLabel}</span>}
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

function ProjectGoalValues({ goal }: { goal: ProjectGoalRecord }) {
  return (
    <dl className="space-y-3">
      {FIELDS.map(({ name, label }) => (
        <div key={name}>
          <dt className="text-sm font-medium">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
            {goal[name] || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
