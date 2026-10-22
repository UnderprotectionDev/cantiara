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
import type { FormEvent } from "react";
import { errorMessage } from "../../lib/error-message";
import { EMPTY_DRAFT } from "../../lib/priority-metric-draft";
import { RankDescriptionsFields } from "../components/rank-descriptions-fields";

export function PriorityMetricCreateForm({
  disabled,
  formError,
  isPending,
  onActionError,
  onCreate,
  onFormError,
  projectId,
}: {
  disabled: boolean;
  formError: string | null;
  isPending: boolean;
  onActionError: (message: string | null) => void;
  onCreate: (input: CreatePriorityMetricInput) => Promise<unknown>;
  onFormError: (message: string | null) => void;
  projectId: string;
}) {
  const createForm = useForm({
    defaultValues: EMPTY_DRAFT,
    onSubmit: async ({ value }) => {
      const parsed = createPriorityMetricInputSchema.safeParse({
        ...value,
        projectId,
      });
      if (!parsed.success) {
        onFormError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      onFormError(null);
      onActionError(null);
      try {
        await onCreate(parsed.data);
        createForm.reset();
      } catch (error) {
        onActionError(
          errorMessage(error, "Priority metric could not be created."),
        );
      }
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    createForm.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Add priority metric"
      className="space-y-4 border-border/70 border-t pt-5"
      noValidate
      onSubmit={handleCreate}
    >
      <h5 className="font-medium text-sm">Add metric</h5>
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
      {formError ? (
        <p className="text-destructive text-sm" role="alert">
          {formError}
        </p>
      ) : null}
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
