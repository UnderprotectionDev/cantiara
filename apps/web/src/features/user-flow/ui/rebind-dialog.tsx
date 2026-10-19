// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview.
import type {
  UserFlowBindView,
  UserFlowRebindPlan,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useEffect, useState } from "react";

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
}: {
  bind: UserFlowBindView;
  onClose: () => void;
  onConfirm: (plan: UserFlowRebindPlan) => Promise<unknown>;
  onPreview: () => Promise<UserFlowRebindPlan>;
}) {
  const [plan, setPlan] = useState<UserFlowRebindPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    onPreview()
      .then((next) => active && setPlan(next))
      .catch(
        () => active && setError("The preview could not be loaded. Reload."),
      );
    return () => {
      active = false;
    };
  }, [onPreview]);

  async function confirm() {
    if (!plan || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(plan);
      onClose();
    } catch {
      setError("The bind could not be moved. If it changed, preview again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
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
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!plan || pending} onClick={confirm} type="button">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
