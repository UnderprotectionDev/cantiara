// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import { PRODUCTION_INCIDENT_FOLLOW_UP_TYPES } from "@cantiara/api/production-incidents";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  type ProductionIncidentFollowUpDraft,
  type ProductionIncidentFollowUpValues,
  productionIncidentFollowUpFormSchema,
} from "../../lib/production-incident-form";

/**
 * First step of `Create follow-up work`: the Work type and title. Submitting
 * asks for the preview; it writes nothing.
 */
export function ProductionIncidentFollowUpForm({
  draft,
  onCancel,
  onPreview,
}: {
  draft: ProductionIncidentFollowUpDraft;
  onCancel: () => void;
  onPreview: (values: ProductionIncidentFollowUpValues) => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: draft,
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = productionIncidentFollowUpFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Enter a title for the Work.");
        return;
      }
      try {
        await onPreview(parsed.data);
      } catch {
        setError("The preview could not be loaded. Retry.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form aria-label="Follow-up work" className="space-y-4" onSubmit={submit}>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="workType">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="production-incident-follow-up-type"
                >
                  Work type
                  <NativeSelect
                    disabled={isSubmitting}
                    id="production-incident-follow-up-type"
                    name="workType"
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        event.target
                          .value as ProductionIncidentFollowUpDraft["workType"],
                      )
                    }
                    value={field.state.value}
                  >
                    {PRODUCTION_INCIDENT_FOLLOW_UP_TYPES.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )}
            </form.Field>
            <form.Field name="title">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="production-incident-follow-up-title"
                >
                  Title
                  <Input
                    disabled={isSubmitting}
                    id="production-incident-follow-up-title"
                    maxLength={255}
                    name="title"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <p className="text-muted-foreground text-sm">
              Nothing is created yet. You will see the Work and its relations
              first.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Loading…" : "Preview"}
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
