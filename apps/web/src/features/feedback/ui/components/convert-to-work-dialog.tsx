// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the record it was made from.
import type {
  FeedbackRecord,
  FeedbackWorkPlan,
  FeedbackWorkType,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  type DialogActions,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { invalidateSmartCollectionMembership, orpc } from "@/utils/orpc";
import { ConvertToWorkForm } from "../forms/convert-to-work-form";

/** Identity of one confirmation attempt; reused on retry so the Work is created once. */
export interface ConvertCommandIdentity {
  id: string;
  key: string;
  workId: string;
}

export type PreviewConvert = (
  workType: FeedbackWorkType,
) => Promise<FeedbackWorkPlan>;
export type ConfirmConvert = (
  plan: FeedbackWorkPlan,
  identity: ConvertCommandIdentity,
) => Promise<unknown>;

/** Read-only account of the single Work and `Origin` a confirmation would create. */
export function ConvertToWorkPreview({ plan }: { plan: FeedbackWorkPlan }) {
  return (
    <section
      aria-label="Convert to Work preview"
      className="space-y-2 rounded-md border border-border/70 p-3 text-sm"
    >
      <p>Confirming creates exactly one Work. Nothing exists until then.</p>
      <dl className="grid gap-1">
        <div className="flex gap-2">
          <dt>Target Project</dt>
          <dd>{plan.targetProject.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Work type</dt>
          <dd>{plan.work.type}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Title</dt>
          <dd>{plan.work.title}</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd className="whitespace-pre-wrap">{plan.work.description}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Relation</dt>
          <dd>Origin: this Feedback to the new Work</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        The Feedback stays as it is. Its status does not change.
      </p>
    </section>
  );
}

interface ConvertToWorkDialogProps {
  onConfirm: ConfirmConvert;
  onPreview: PreviewConvert;
  record: FeedbackRecord;
}

export function ConvertToWorkDialog(props: ConvertToWorkDialogProps) {
  const actions = useRef<DialogActions | null>(null);
  const busy = useRef<boolean>(false);

  return (
    <Dialog
      actionsRef={actions}
      onOpenChange={(open, event) => {
        if (!open && busy.current && event.reason !== "imperative-action") {
          event.cancel();
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        Convert to Work
      </DialogTrigger>
      <DialogContent>
        <ConvertToWorkContent
          {...props}
          busy={busy}
          onClose={() => actions.current?.close()}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConvertToWorkContent({
  busy,
  onClose,
  onConfirm,
  onPreview,
  record,
}: ConvertToWorkDialogProps & {
  busy: RefObject<boolean>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const active = useRef<ConvertCommandIdentity | null>(null);
  useEffect(
    () => () => {
      active.current = null;
    },
    [],
  );
  const inspect = useMutation({
    mutationKey: orpc.previewFeedbackWork.mutationKey(),
    mutationFn: onPreview,
  });
  const convert = useMutation({
    mutationKey: orpc.convertFeedbackToWork.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      plan: submitted,
      identity,
    }: {
      plan: FeedbackWorkPlan;
      identity: ConvertCommandIdentity;
    }) => onConfirm(submitted, identity),
    onSuccess: async (_, { plan: submitted, identity }) => {
      const projectId = submitted.targetProject.id;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectFeedback.key({ input: { projectId } }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.key({ input: { projectId } }),
        }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
      if (active.current?.key === identity.key) {
        active.current = null;
        onClose();
      }
    },
  });
  const plan = inspect.data;
  const pending = inspect.isPending || convert.isPending;
  let error: string | null = null;
  if (inspect.isError) {
    error = "The preview could not be loaded. Reload and try again.";
  }
  if (convert.isError) {
    error =
      "The Work could not be created. If the Feedback changed, preview again.";
  }
  function reset() {
    active.current = null;
    inspect.reset();
    convert.reset();
  }
  async function preview(workType: FeedbackWorkType) {
    reset();
    await inspect.mutateAsync(workType).catch(() => undefined);
  }
  async function confirm() {
    if (plan && !pending) {
      active.current ??= {
        id: crypto.randomUUID(),
        key: crypto.randomUUID(),
        workId: crypto.randomUUID(),
      };
      await convert
        .mutateAsync({ plan, identity: active.current })
        .catch(() => undefined);
    }
  }

  useLayoutEffect(() => {
    busy.current = pending;
    return () => {
      busy.current = false;
    };
  }, [busy, pending]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Convert to Work</DialogTitle>
        <DialogDescription>
          {record.title}. This creates no AI summary, exactly one Work, and does
          not delete or archive the Feedback.
        </DialogDescription>
      </DialogHeader>
      <ConvertToWorkForm
        canConfirm={plan !== undefined}
        onClose={() => {
          if (!pending) {
            onClose();
          }
        }}
        onConfirm={confirm}
        onPreview={preview}
        onWorkTypeChange={reset}
        pending={pending}
        recordId={record.id}
      >
        {plan ? <ConvertToWorkPreview plan={plan} /> : null}
        {error ? <p role="alert">{error}</p> : null}
      </ConvertToWorkForm>
    </>
  );
}
