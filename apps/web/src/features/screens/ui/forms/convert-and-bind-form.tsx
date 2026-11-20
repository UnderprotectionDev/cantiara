// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected block.
import {
  CONVERT_AND_BIND_TARGET_TYPES,
  type ConfirmConvertAndBindInput,
  type ConvertAndBindPlan,
  type ConvertAndBindTargetType,
  convertAndBindWorkTypeSchema,
  type ScreenBlockOriginView,
} from "@cantiara/api/screen-origins";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { convertAndBindFormSchema } from "../../lib/screen-forms";

const WORK_TYPES = convertAndBindWorkTypeSchema.options;

export interface ConvertPreviewRequest {
  blockId: string;
  targetType: ConvertAndBindTargetType;
  title?: string;
  workType?: (typeof WORK_TYPES)[number];
}

export interface ConvertAndBindActions {
  /** Confirms the exact previewed plan; creates exactly one record. */
  confirm: (
    input: ConfirmConvertAndBindInput,
  ) => Promise<ScreenBlockOriginView>;
  /** Read-only: nothing exists until `confirm`. */
  preview: (input: ConvertPreviewRequest) => Promise<ConvertAndBindPlan>;
}

/**
 * `Convert and Bind` on the selected block, mounted in the inspector area
 * beside the compact outline. It previews one target, creates nothing until
 * `Confirm`, and never touches the block or the canvas.
 */
export function ConvertAndBindPanel({
  actions,
  blockId,
}: {
  actions: ConvertAndBindActions;
  blockId: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = useMutation({
    meta: { retryInSurface: true },
    mutationFn: (request: ConvertPreviewRequest) => actions.preview(request),
    mutationKey: orpc.previewConvertAndBind.mutationKey(),
  });
  const confirm = useMutation({
    meta: { onlineWrite: true, retryInSurface: true },
    mutationFn: (input: ConfirmConvertAndBindInput) => actions.confirm(input),
    mutationKey: orpc.confirmConvertAndBind.mutationKey(),
  });
  const plan = preview.data;
  const created = confirm.data;
  const busy = preview.isPending || confirm.isPending;
  const previewError = preview.isError ? "Preview is unavailable." : undefined;
  const requestError = confirm.isError
    ? "The preview is out of date. Preview again."
    : previewError;

  function resetPreview() {
    preview.reset();
    confirm.reset();
  }

  const form = useForm({
    defaultValues: {
      targetType: "Decision" as ConvertAndBindTargetType,
      title: "",
      workType: "Task" as (typeof WORK_TYPES)[number],
    },
    listeners: { onChange: resetPreview },
    validators: {
      onSubmit: ({ value }) =>
        convertAndBindFormSchema.safeParse(value).success
          ? undefined
          : "Preview is unavailable.",
    },
    onSubmit: async ({ value }) => {
      confirm.reset();
      await preview.mutateAsync({
        blockId,
        ...convertAndBindFormSchema.parse(value),
      });
    },
  });

  function close() {
    setOpen(false);
    resetPreview();
  }

  function confirmPlan() {
    if (!plan || busy) {
      return;
    }
    const input =
      confirm.isError && confirm.variables?.plan === plan
        ? confirm.variables
        : {
            originId: crypto.randomUUID(),
            plan,
            projectId: plan.projectId,
            recordId: crypto.randomUUID(),
            screenId: plan.screenId,
          };
    confirm.mutate(input, {
      onSuccess: () => {
        setOpen(false);
        preview.reset();
      },
    });
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <Button
          onClick={() => {
            confirm.reset();
            setOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Convert and Bind
        </Button>
        {created ? (
          <p className="text-xs" role="status">
            Created {created.target.type}: {created.target.title}. Origin
            Location: Wireframe version {created.location.wireframeVersion}.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form
      aria-label="Convert and Bind"
      className="space-y-2 rounded-lg border border-border/70 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <fieldset
        className="flex flex-wrap items-center gap-2"
        disabled={confirm.isPending}
      >
        <label className="text-xs" htmlFor="convert-target-type">
          Target type
        </label>
        <form.Field name="targetType">
          {(field) => (
            <NativeSelect
              id="convert-target-type"
              onChange={(event) =>
                field.handleChange(
                  event.target.value as ConvertAndBindTargetType,
                )
              }
              value={field.state.value}
            >
              {CONVERT_AND_BIND_TARGET_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.targetType}>
          {(targetType) =>
            targetType === "Work" ? (
              <>
                <label className="text-xs" htmlFor="convert-work-type">
                  Work type
                </label>
                <form.Field name="workType">
                  {(field) => (
                    <NativeSelect
                      id="convert-work-type"
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value as (typeof WORK_TYPES)[number],
                        )
                      }
                      value={field.state.value}
                    >
                      {WORK_TYPES.map((type) => (
                        <NativeSelectOption key={type} value={type}>
                          {type}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </form.Field>
              </>
            ) : null
          }
        </form.Subscribe>
        <label className="text-xs" htmlFor="convert-title">
          Title
        </label>
        <form.Field name="title">
          {(field) => (
            <Input
              className="w-56"
              id="convert-title"
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="From the block"
              value={field.state.value}
            />
          )}
        </form.Field>
        <Button disabled={busy} size="sm" type="submit">
          Preview
        </Button>
        <Button onClick={close} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </fieldset>
      {plan ? (
        <dl aria-label="Convert and Bind preview" className="space-y-1 text-xs">
          <div>
            <dt className="inline font-medium">Target type: </dt>
            <dd className="inline">{plan.targetType}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Project: </dt>
            <dd className="inline">{plan.targetProject.name}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Title: </dt>
            <dd className="inline">{plan.title}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Body: </dt>
            <dd className="inline">{plan.body}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Origin: </dt>
            <dd className="inline">{plan.screenTitle}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Origin Location: </dt>
            <dd className="inline">
              {plan.screenTitle}, block {plan.originLocation.blockId}, Wireframe
              version {plan.originLocation.wireframeVersion}
            </dd>
          </div>
        </dl>
      ) : null}
      {plan ? (
        <Button disabled={busy} onClick={confirmPlan} size="sm" type="button">
          Confirm
        </Button>
      ) : null}
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(validationError) => {
          const error = validationError ?? requestError;
          return error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null;
        }}
      </form.Subscribe>
    </form>
  );
}
