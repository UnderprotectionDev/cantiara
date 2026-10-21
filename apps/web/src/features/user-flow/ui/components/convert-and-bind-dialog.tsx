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
  Dialog,
  DialogContent,
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
import { useRef, useState } from "react";

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
}: {
  node: UserFlowNodeView;
  onClose: () => void;
  onConfirm: ConfirmConvertAndBind;
  onPreview: PreviewConvertAndBind;
}) {
  const [target, setTarget] = useState<UserFlowConvertTarget>("Work");
  const [workType, setWorkType] = useState<UserFlowWorkType>("Task");
  const [plan, setPlan] = useState<UserFlowConvertPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const identity = useRef<ConvertAndBindIdentity | null>(null);

  function reset() {
    setPlan(null);
    setError(null);
    identity.current = null;
  }
  async function preview() {
    setPending(true);
    reset();
    try {
      setPlan(await onPreview(target, workType));
    } catch {
      setError(
        "The preview could not be loaded. Save or discard edits and try again.",
      );
    } finally {
      setPending(false);
    }
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
    setPending(true);
    setError(null);
    try {
      await onConfirm(plan, identity.current);
      identity.current = null;
      onClose();
    } catch {
      setError(
        `The ${plan.record.type} could not be created. If the User Flow changed, preview again.`,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert and Bind</DialogTitle>
          <DialogDescription>
            {node.kind} node. This creates exactly one Work, Decision, Risk or
            Open Question, never a Screen, and the node stays where it is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`convert-target-${node.id}`}>Record type</Label>
          <NativeSelect
            disabled={pending}
            id={`convert-target-${node.id}`}
            onChange={(event) => {
              setTarget(event.target.value as UserFlowConvertTarget);
              reset();
            }}
            value={target}
          >
            {USER_FLOW_CONVERT_TARGETS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {target === "Work" ? (
          <div className="space-y-2">
            <Label htmlFor={`convert-work-type-${node.id}`}>Work type</Label>
            <NativeSelect
              disabled={pending}
              id={`convert-work-type-${node.id}`}
              onChange={(event) => {
                setWorkType(event.target.value as UserFlowWorkType);
                reset();
              }}
              value={workType}
            >
              {USER_FLOW_WORK_TYPES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        {plan ? <ConvertAndBindPreview plan={plan} /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={preview}
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          <Button disabled={!plan || pending} onClick={confirm} type="button">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
