// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.

import {
  PUBLIC_ROADMAP_REVIEW_MAX_DAYS,
  PUBLIC_ROADMAP_REVIEW_MIN_DAYS,
  setPublicRoadmapReviewIntervalInputSchema,
} from "@cantiara/api/attention-signals-public-roadmap";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import { useId } from "react";
import { submitForm } from "@/lib/submit-form";

const intervalSchema = setPublicRoadmapReviewIntervalInputSchema.pick({
  days: true,
});

export default function PublicRoadmapReviewForm({
  days,
  disabled,
  onSave,
}: {
  days: number | null;
  disabled: boolean;
  onSave: (days: number | null) => Promise<unknown>;
}) {
  const inputId = useId();
  const form = useForm({
    defaultValues: { days: days === null ? "" : String(days) },
    onSubmit: async ({ value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = intervalSchema.safeParse({
        days: value.days.trim() === "" ? null : Number(value.days),
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: `Enter a whole number of days from ${PUBLIC_ROADMAP_REVIEW_MIN_DAYS} to ${PUBLIC_ROADMAP_REVIEW_MAX_DAYS}.`,
            fields: {},
          },
        });
        return;
      }
      try {
        await onSave(parsed.data.days);
      } catch (caught) {
        form.setErrorMap({
          onSubmit: {
            form:
              caught instanceof Error && caught.message
                ? caught.message
                : "The interval was not saved.",
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
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form).catch(() => undefined);
      }}
    >
      <form.Field name="days">
        {(field) => (
          <div className="grid gap-1">
            <label className="text-sm" htmlFor={inputId}>
              Review interval (days)
            </label>
            <Input
              disabled={disabled}
              id={inputId}
              inputMode="numeric"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <Button disabled={disabled} type="submit">
        Save interval
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
