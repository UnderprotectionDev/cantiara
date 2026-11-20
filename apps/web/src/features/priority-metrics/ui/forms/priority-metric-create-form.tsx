// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import {
  type CreatePriorityMetricInput,
  createPriorityMetricInputSchema,
} from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { EMPTY_DRAFT } from "../../lib/priority-metric-draft";
import { RankDescriptionsFields } from "../components/rank-descriptions-fields";

export function PriorityMetricCreateForm({
  disabled,
  isPending,
  onCreate,
  projectId,
}: {
  disabled: boolean;
  isPending: boolean;
  onCreate: (input: CreatePriorityMetricInput) => Promise<unknown>;
  projectId: string;
}) {
  const createForm = useForm({
    defaultValues: EMPTY_DRAFT,
    validators: {
      onSubmit: ({ value }) => {
        const parsed = createPriorityMetricInputSchema.safeParse({
          ...value,
          projectId,
        });
        return parsed.success
          ? undefined
          : (parsed.error.issues[0]?.message ?? "Check the form.");
      },
    },
    onSubmit: async ({ value }) => {
      try {
        await onCreate(
          createPriorityMetricInputSchema.parse({ ...value, projectId }),
        );
        createForm.reset();
      } catch {
        // The editor reports the mutation's failure while the form keeps the draft.
      }
    },
  });

  function handleCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    createForm.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Add priority metric"
      className="space-y-4 border-t border-border/70 pt-5"
      noValidate
      onSubmit={handleCreate}
    >
      <h5 className="text-sm font-medium">Add metric</h5>
      <FieldGroup>
        <createForm.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="priority-metric-name">Name</FieldLabel>
              <Input
                disabled={disabled || isPending}
                id="priority-metric-name"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </Field>
          )}
        </createForm.Field>
        <createForm.Field name="shortDescription">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="priority-metric-short-description">
                Short description
              </FieldLabel>
              <Textarea
                disabled={disabled || isPending}
                id="priority-metric-short-description"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </Field>
          )}
        </createForm.Field>
        <createForm.Subscribe
          selector={(state) => state.values.rankDescriptions}
        >
          {(rankDescriptions) => (
            <RankDescriptionsFields
              disabled={disabled || isPending}
              idPrefix="priority-metric-new"
              onChange={(rank, value) =>
                createForm.setFieldValue("rankDescriptions", {
                  ...rankDescriptions,
                  [rank]: value,
                })
              }
              rankDescriptions={rankDescriptions}
            />
          )}
        </createForm.Subscribe>
      </FieldGroup>
      <createForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(formError) =>
          typeof formError === "string" ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null
        }
      </createForm.Subscribe>
      <createForm.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            disabled={disabled || isPending || isSubmitting}
            type="submit"
          >
            Add metric
          </Button>
        )}
      </createForm.Subscribe>
    </form>
  );
}
