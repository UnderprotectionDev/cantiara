// biome-ignore-all lint/performance/noJsxPropsBind: Milestone controls bind to the current Project and record.

import type { Milestone } from "@cantiara/api/roadmap-horizon";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { DatePicker } from "@/components/date-picker";
import { submitForm } from "@/lib/submit-form";
import { milestoneFormSchema } from "../../lib/milestone-forms";

export interface MilestoneDraft {
  description: string;
  targetDate: string;
  title: string;
}

export const EMPTY_DRAFT: MilestoneDraft = {
  description: "",
  targetDate: "",
  title: "",
};

export function milestoneDraft(milestone: Milestone): MilestoneDraft {
  return {
    description: milestone.description ?? "",
    targetDate: milestone.targetDate ?? "",
    title: milestone.title,
  };
}

export function MilestoneEditor({
  className,
  error,
  initialValues,
  onCancel,
  onSave,
  prefix,
  submitLabel,
}: {
  className: string;
  error: boolean;
  initialValues: MilestoneDraft;
  onCancel?: () => void;
  onSave: (draft: MilestoneDraft) => Promise<unknown>;
  prefix: string;
  submitLabel: string;
}) {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      const parsed = milestoneFormSchema.safeParse({
        ...value,
        description: value.description.trim(),
      });
      if (!parsed.success) {
        form.setErrorMap({ onSubmit: { form: true, fields: {} } });
        return;
      }
      await onSave(parsed.data);
      form.reset(initialValues);
    },
  });
  const invalid = useSelector(form.store, (state) => state.errorMap.onSubmit);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field name="title">
              {(field) => (
                <label
                  className="grid gap-1 text-sm"
                  htmlFor={`${prefix}-title`}
                >
                  Title
                  <Input
                    disabled={isSubmitting}
                    id={`${prefix}-title`}
                    maxLength={255}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="targetDate">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${prefix}-target-date`}>
                    Target date
                  </FieldLabel>
                  <DatePicker
                    ariaLabel="Target date"
                    clearLabel="Clear date"
                    disabled={isSubmitting}
                    id={`${prefix}-target-date`}
                    onChange={field.handleChange}
                    placeholder="Choose a calendar date."
                    value={field.state.value}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <label
                  className="grid gap-1 text-sm sm:col-span-2"
                  htmlFor={`${prefix}-description`}
                >
                  Description
                  <Textarea
                    disabled={isSubmitting}
                    id={`${prefix}-description`}
                    maxLength={20_000}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
          </div>
        )}
      </form.Subscribe>
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel ? (
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            )}
          </form.Subscribe>
        ) : null}
      </div>
      {error || invalid ? (
        <p className="text-sm text-destructive" role="alert">
          This action could not be completed.
        </p>
      ) : null}
    </form>
  );
}
