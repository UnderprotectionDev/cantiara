// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the node it was made from.

import {
  USER_FLOW_CONVERT_TARGETS,
  USER_FLOW_WORK_TYPES,
  type UserFlowConvertPlan,
  type UserFlowConvertTarget,
  type UserFlowNodeView,
  type UserFlowWorkType,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";
import { convertAndBindFormSchema } from "../../lib/user-flow-forms";

/** Identity of one confirmation attempt; reused on retry so the record is created once. */
export interface ConvertAndBindIdentity {
  id: string;
  key: string;
  recordId: string;
}

export type PreviewConvertAndBind = (
  target: UserFlowConvertTarget,
  workType: UserFlowWorkType,
) => Promise<UserFlowConvertPlan>;
export type ConfirmConvertAndBind = (
  plan: UserFlowConvertPlan,
  identity: ConvertAndBindIdentity,
) => Promise<unknown>;

/** Read-only account of the single record, `Origin` and Origin Location a confirmation would create. */
export function ConvertAndBindPreview({ plan }: { plan: UserFlowConvertPlan }) {
  return (
    <section
      aria-label="Convert and Bind preview"
      className="space-y-2 rounded-md border border-border/70 p-3 text-sm"
    >
      <p>
        Confirming creates exactly one {plan.record.type}. Nothing exists until
        then.
      </p>
      <dl className="grid gap-1">
        <div className="flex gap-2">
          <dt>Target Project</dt>
          <dd>{plan.targetProject.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Record type</dt>
          <dd>{plan.record.type}</dd>
        </div>
        {plan.record.workType ? (
          <div className="flex gap-2">
            <dt>Work type</dt>
            <dd>{plan.record.workType}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Title</dt>
          <dd>{plan.record.title}</dd>
        </div>
        <div>
          <dt>Body</dt>
          <dd className="whitespace-pre-wrap">{plan.record.body}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Relation</dt>
          <dd>Origin: this node to the new {plan.record.type}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Origin Location</dt>
          <dd>
            User Flow {plan.originLocation.userFlowId} · node{" "}
            {plan.originLocation.nodeId} · version{" "}
            {plan.originLocation.flowVersion}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        The node stays, keeps its type and does not become a relation endpoint.
        No Screen is created.
      </p>
    </section>
  );
}

export function ConvertAndBindDialog({
  node,
  onClose,
  onConfirm,
  onPreview,
  resetWrite,
  write,
}: {
  node: UserFlowNodeView;
  onClose: () => void;
  onConfirm: ConfirmConvertAndBind;
  onPreview: PreviewConvertAndBind;
  resetWrite?: () => void;
  write?: { error: unknown; isPending: boolean; isSuccess: boolean };
}) {
  const inspect = useMutation({
    mutationKey: orpc.previewUserFlowConvert.mutationKey(),
    mutationFn: (values: Parameters<PreviewConvertAndBind>) =>
      onPreview(...values),
    meta: { presentsSupportFailure: true },
  });
  const plan = inspect.data;
  const pending = inspect.isPending || Boolean(write?.isPending);
  const identity = useRef<ConvertAndBindIdentity | null>(null);
  let error: string | null = null;
  if (inspect.isError) {
    error =
      "The preview could not be loaded. Save or discard edits and try again.";
  } else if (write?.error && plan) {
    error = `The ${plan.record.type} could not be created. If the User Flow changed, preview again.`;
  }
  const completed = write?.isSuccess;
  useEffect(() => {
    if (completed) {
      onClose();
    }
  }, [completed, onClose]);
  function reset() {
    inspect.reset();
    resetWrite?.();
    identity.current = null;
  }
  const form = useForm({
    defaultValues: {
      target: "Work" as UserFlowConvertTarget,
      workType: "Task" as UserFlowWorkType,
    },
    // Any edit invalidates the previewed plan and its confirmation identity.
    listeners: { onChange: reset },
    onSubmitMeta: { action: "preview" } as { action: "confirm" | "preview" },
    onSubmit: ({ meta, value }) =>
      meta.action === "confirm" ? confirm() : preview(value),
  });
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const validation = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const busy = pending || submitting;
  const message = validation ?? error;
  async function preview(value: {
    target: UserFlowConvertTarget;
    workType: UserFlowWorkType;
  }) {
    const parsed = convertAndBindFormSchema.safeParse(value);
    if (!parsed.success) {
      form.setErrorMap({
        onSubmit: {
          form:
            parsed.error.issues[0]?.message ?? "Check the conversion options.",
          fields: {},
        },
      });
      return;
    }
    reset();
    await inspect
      .mutateAsync([parsed.data.target, parsed.data.workType])
      .catch(() => undefined);
  }
  async function confirm() {
    if (!plan || pending) {
      return;
    }
    identity.current ??= {
      id: crypto.randomUUID(),
      key: crypto.randomUUID(),
      recordId: crypto.randomUUID(),
    };
    await onConfirm(plan, identity.current);
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Convert and Bind</DialogTitle>
        <DialogDescription>
          {node.kind} node. This creates exactly one Work, Decision, Risk or
          Open Question, never a Screen, and the node stays where it is.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-2"
        id={`convert-and-bind-form-${node.id}`}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submitForm(form).catch(() => undefined);
        }}
      >
        <Label htmlFor={`convert-target-${node.id}`}>Record type</Label>
        <form.Field name="target">
          {(field) => (
            <NativeSelect
              disabled={busy}
              id={`convert-target-${node.id}`}
              onChange={(event) =>
                field.handleChange(event.target.value as UserFlowConvertTarget)
              }
              value={field.state.value}
            >
              {USER_FLOW_CONVERT_TARGETS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.target}>
          {(target) =>
            target === "Work" ? (
              <div className="space-y-2">
                <Label htmlFor={`convert-work-type-${node.id}`}>
                  Work type
                </Label>
                <form.Field name="workType">
                  {(field) => (
                    <NativeSelect
                      disabled={busy}
                      id={`convert-work-type-${node.id}`}
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value as UserFlowWorkType,
                        )
                      }
                      value={field.state.value}
                    >
                      {USER_FLOW_WORK_TYPES.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {value}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </form.Field>
              </div>
            ) : null
          }
        </form.Subscribe>
      </form>
      {plan ? <ConvertAndBindPreview plan={plan} /> : null}
      {message ? <p role="alert">{message}</p> : null}
      <DialogFooter>
        <DialogClose
          disabled={Boolean(write?.isPending)}
          render={<Button variant="outline" />}
        >
          Cancel
        </DialogClose>
        <Button
          disabled={busy}
          form={`convert-and-bind-form-${node.id}`}
          type="submit"
          variant="outline"
        >
          Preview
        </Button>
        <Button
          disabled={!plan || busy}
          onClick={() =>
            submitForm(form, { action: "confirm" }).catch(() => undefined)
          }
          type="button"
        >
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}
