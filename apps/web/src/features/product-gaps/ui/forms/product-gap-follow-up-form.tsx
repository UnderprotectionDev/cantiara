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
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { orpc } from "@/utils/orpc";
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
  write,
}: {
  loadTargets: LoadProductGapTargets;
  onConfirm: ConfirmFollowUp;
  onPreview: PreviewFollowUp;
  record: ProductGapRecord;
  write?: {
    error: unknown;
    isPending: boolean;
    isSuccess: boolean;
    reset: () => void;
    variables?: { plan: ProductGapFollowUpPlan };
  };
}) {
  const id = useId();
  const inspect = useMutation({
    mutationKey: orpc.previewProductGapFollowUp.mutationKey(),
    mutationFn: (request: FollowUpRequest) => onPreview(record, request),
    meta: { presentsSupportFailure: true },
  });
  const saved = write?.isSuccess;
  const plan = saved ? undefined : inspect.data;
  const busy = Boolean(write?.isPending || inspect.isPending);
  let message = "";
  if (saved && write.variables) {
    message =
      write.variables.plan.kind === "Work"
        ? "Follow-up Work created."
        : "Follow-up Feature related.";
  }
  function resetPreview() {
    inspect.reset();
    write?.reset();
  }
  const form = useForm({
    defaultValues: {
      kind: "Work" as FollowUpKind,
      targetId: "",
      workType: "Task" as ProductGapFollowUpWorkType,
    },
    listeners: { onChange: resetPreview },
    onSubmit: async ({ value }) => {
      write?.reset();
      const request: FollowUpRequest =
        value.kind === "Work"
          ? {
              kind: value.kind,
              projectId: value.targetId,
              workType: value.workType,
            }
          : { featureId: value.targetId, kind: value.kind };
      await inspect.mutateAsync(request).catch(() => undefined);
    },
    validators: {
      onSubmit: ({ value }) => {
        const target =
          value.kind === "Work"
            ? {
                kind: value.kind,
                projectId: value.targetId,
                workType: value.workType,
              }
            : { featureId: value.targetId, kind: value.kind };
        return previewProductGapFollowUpInputSchema.safeParse({
          ...target,
          gapId: record.id,
        }).success
          ? undefined
          : "The follow-up preview is unavailable.";
      },
    },
  });
  const validation = useSelector(
    form.store,
    (state) => state.errorMap.onSubmit,
  );
  let error: string | undefined = validation;
  if (inspect.isError) {
    error = errorText(inspect.error, "The follow-up preview is unavailable.");
  } else if (write?.error) {
    error = errorText(write.error, "The follow-up was not created.");
  }
  useEffect(() => {
    if (saved) {
      form.resetField("targetId");
    }
  }, [form, saved]);
  const kind = useSelector(form.store, (state) => state.values.kind);

  const { data: targets = [], isError: targetsFailed } =
    useProductGapLinkTargets(
      loadTargets,
      kind === "Work" ? "Project" : "Feature",
    );

  function confirm() {
    if (plan && !busy) {
      onConfirm(record, plan).catch(() => undefined);
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
              disabled={!targetId || busy || pending === true}
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
              <Button disabled={busy} onClick={confirm} size="sm" type="button">
                Confirm follow-up
              </Button>
              <Button
                disabled={busy}
                onClick={resetPreview}
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
