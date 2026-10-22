// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the selected Gap.
import {
  PRODUCT_GAP_FOLLOW_UP_WORK_TYPES,
  type ProductGapFollowUpPlan,
  type ProductGapFollowUpWorkType,
  type ProductGapRecord,
  previewProductGapFollowUpInputSchema,
} from "@cantiara/api/product-gaps";
import { Alert } from "@cantiara/ui/components/alert";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useState } from "react";
import { useProductGapLinkTargets } from "../../hooks/use-product-gap-link-targets";
import { errorText } from "../../lib/product-gap-form";
import type { LoadProductGapTargets } from "../components/product-gap-links-field";

type FollowUpKind = "Feature relation" | "Work";

type FollowUpRequest =
  | { kind: "Feature relation"; featureId: string }
  | { kind: "Work"; projectId: string; workType: ProductGapFollowUpWorkType };

export type PreviewFollowUp = (
  gap: ProductGapRecord,
  request: FollowUpRequest,
) => Promise<ProductGapFollowUpPlan>;
export type ConfirmFollowUp = (
  gap: ProductGapRecord,
  plan: ProductGapFollowUpPlan,
) => Promise<unknown>;

function PlanSummary({ plan }: { plan: ProductGapFollowUpPlan }) {
  if (plan.kind === "Feature relation") {
    return (
      <p>{`Relate Feature ${plan.feature.label} as a follow-up. No Work is created.`}</p>
    );
  }
  return (
    <div className="space-y-1">
      <p>{`Create 1 ${plan.work.type} in ${plan.targetProject.name}.`}</p>
      <p>{`Title: ${plan.work.title}`}</p>
      {plan.work.description ? (
        <p className="whitespace-pre-wrap">{`Description: ${plan.work.description}`}</p>
      ) : null}
    </div>
  );
}

/**
 * Optional follow-up. Nothing is written by choosing a target: the founder
 * reads the preview and confirms that exact plan, or discards it.
 */
export function FollowUpPanel({
  loadTargets,
  onConfirm,
  onPreview,
  record,
}: {
  loadTargets: LoadProductGapTargets;
  onConfirm: ConfirmFollowUp;
  onPreview: PreviewFollowUp;
  record: ProductGapRecord;
}) {
  const id = useId();
  const [plan, setPlan] = useState<ProductGapFollowUpPlan | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");
  const form = useForm({
    defaultValues: {
      kind: "Work" as FollowUpKind,
      targetId: "",
      workType: "Task" as ProductGapFollowUpWorkType,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      setMessage("");
      const parsed = previewProductGapFollowUpInputSchema.safeParse(
        value.kind === "Work"
          ? {
              gapId: record.id,
              kind: value.kind,
              projectId: value.targetId,
              workType: value.workType,
            }
          : { featureId: value.targetId, gapId: record.id, kind: value.kind },
      );
      if (!parsed.success) {
        setError("The follow-up preview is unavailable.");
        return;
      }
      try {
        setPlan(
          await onPreview(
            record,
            value.kind === "Work"
              ? {
                  kind: value.kind,
                  projectId: value.targetId,
                  workType: value.workType,
                }
              : { featureId: value.targetId, kind: value.kind },
          ),
        );
      } catch (caught) {
        setError(errorText(caught, "The follow-up preview is unavailable."));
      }
    },
  });
  const kind = useStore(form.store, (state) => state.values.kind);

  const { data: targets = [], isError: targetsFailed } =
    useProductGapLinkTargets(
      loadTargets,
      kind === "Work" ? "Project" : "Feature",
    );

  async function confirm() {
    if (!plan) {
      return;
    }
    setError(undefined);
    try {
      await onConfirm(record, plan);
      setPlan(null);
      form.setFieldValue("targetId", "");
      setMessage(
        plan.kind === "Work"
          ? "Follow-up Work created."
          : "Follow-up Feature related.",
      );
    } catch (caught) {
      setPlan(null);
      setError(errorText(caught, "The follow-up was not created."));
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <FieldSet className="gap-3 rounded-md border border-border/70 p-3 text-sm">
        <FieldLegend
          className="mb-0 px-1"
          variant="label"
        >{`Follow-up for ${record.title}`}</FieldLegend>
        <div className="grid gap-3 sm:grid-cols-3">
          <form.Field name="kind">
            {(field) => (
              <Field className="gap-1">
                <FieldLabel htmlFor={`${id}-kind`}>Follow-up kind</FieldLabel>
                <NativeSelect
                  id={`${id}-kind`}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value as FollowUpKind);
                    form.setFieldValue("targetId", "");
                    setPlan(null);
                  }}
                  value={field.state.value}
                >
                  <NativeSelectOption value="Work">
                    Create follow-up work
                  </NativeSelectOption>
                  <NativeSelectOption value="Feature relation">
                    Relate a Feature
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          </form.Field>
          {kind === "Work" ? (
            <form.Field name="workType">
              {(field) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor={`${id}-type`}>Work type</FieldLabel>
                  <NativeSelect
                    id={`${id}-type`}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(
                        event.target.value as ProductGapFollowUpWorkType,
                      );
                      setPlan(null);
                    }}
                    value={field.state.value}
                  >
                    {PRODUCT_GAP_FOLLOW_UP_WORK_TYPES.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </form.Field>
          ) : null}
          <form.Field name="targetId">
            {(field) => (
              <Field className="gap-1">
                <FieldLabel htmlFor={`${id}-target`}>
                  {kind === "Work" ? "Target Project" : "Feature"}
                </FieldLabel>
                <NativeSelect
                  id={`${id}-target`}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setPlan(null);
                  }}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    {kind === "Work" ? "Choose a Project" : "Choose a Feature"}
                  </NativeSelectOption>
                  {targets.map((target) => (
                    <NativeSelectOption
                      key={target.targetId}
                      value={target.targetId}
                    >
                      {target.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </div>
        <form.Subscribe
          selector={(state) => [state.values.targetId, state.isSubmitting]}
        >
          {([targetId, pending]) => (
            <Button
              disabled={!targetId || pending === true}
              size="sm"
              type="submit"
              variant="outline"
            >
              Preview follow-up
            </Button>
          )}
        </form.Subscribe>
        {plan ? (
          <section
            aria-label={`Follow-up preview for ${record.title}`}
            className="space-y-2 rounded-md bg-muted/40 p-3"
          >
            <PlanSummary plan={plan} />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  confirm().catch(() => undefined);
                }}
                size="sm"
                type="button"
              >
                Confirm follow-up
              </Button>
              <Button
                onClick={() => setPlan(null)}
                size="sm"
                type="button"
                variant="outline"
              >
                Discard preview
              </Button>
            </div>
          </section>
        ) : null}
        {error || targetsFailed ? (
          <Alert variant="destructive">
            {error || "Follow-up targets could not be loaded."}
          </Alert>
        ) : null}
        <p aria-live="polite" className="text-muted-foreground" role="status">
          {message}
        </p>
      </FieldSet>
    </form>
  );
}
