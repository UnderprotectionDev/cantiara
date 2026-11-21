// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview.
import type {
  UserFlowBindView,
  UserFlowRebindPlan,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { orpc } from "@/utils/orpc";

/** Read-only account of the move a rebind would make; the Origin Location never changes. */
export function RebindPreview({ plan }: { plan: UserFlowRebindPlan }) {
  return (
    <section
      aria-label="Rebind preview"
      className="space-y-2 rounded-md border border-border/70 p-3 text-sm"
    >
      <dl className="grid gap-1">
        <div className="flex gap-2">
          <dt>Bound version</dt>
          <dd>
            {plan.fromVersion} to {plan.toVersion}
          </dd>
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
        The Origin Location stays on version {plan.originLocation.flowVersion}.
        Only the version this bind follows moves.
      </p>
    </section>
  );
}

/** `Rebind` is always preview first: the dialog opens on the preview and confirms that exact plan. */
export function RebindDialog({
  bind,
  onClose,
  onConfirm,
  onPreview,
  projectId,
  flowId,
  write,
}: {
  bind: UserFlowBindView;
  onClose: () => void;
  onConfirm: (plan: UserFlowRebindPlan) => Promise<unknown>;
  onPreview: () => Promise<UserFlowRebindPlan>;
  projectId: string;
  flowId: string;
  write?: { error: unknown; isPending: boolean; isSuccess: boolean };
}) {
  const preview = useQuery({
    ...orpc.previewUserFlowRebind.queryOptions({
      input: { bindId: bind.id, userFlowId: flowId, projectId },
    }),
    gcTime: 0,
    queryFn: onPreview,
    staleTime: 0,
  });
  const plan = preview.data;
  const pending = Boolean(write?.isPending);
  let error: string | undefined;
  if (preview.isError) {
    error = "The preview could not be loaded. Reload.";
  } else if (write?.error) {
    error = "The bind could not be moved. If it changed, preview again.";
  }
  const completed = write?.isSuccess;
  useEffect(() => {
    if (completed) {
      onClose();
    }
  }, [completed, onClose]);
  function confirm() {
    if (plan && !pending) {
      onConfirm(plan).catch(() => undefined);
    }
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Rebind</DialogTitle>
        <DialogDescription>
          Move the bind of {bind.record.title ?? "this record"} to the current
          version of the node. Nothing moves until you confirm.
        </DialogDescription>
      </DialogHeader>
      {plan ? <RebindPreview plan={plan} /> : null}
      {error ? <p role="alert">{error}</p> : null}
      <DialogFooter>
        <DialogClose
          disabled={Boolean(write?.isPending)}
          render={<Button variant="outline" />}
        >
          Cancel
        </DialogClose>
        <Button disabled={!plan || pending} onClick={confirm} type="button">
          Confirm
        </Button>
      </DialogFooter>
    </>
  );
}
