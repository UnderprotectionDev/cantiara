// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the record it was made from.
import {
  FEEDBACK_WORK_TYPES,
  type FeedbackRecord,
  type FeedbackWorkPlan,
  type FeedbackWorkType,
} from "@cantiara/api/feedback";
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

export function ConvertToWorkDialog({
  onClose,
  onConfirm,
  onPreview,
  record,
}: {
  onClose: () => void;
  onConfirm: ConfirmConvert;
  onPreview: PreviewConvert;
  record: FeedbackRecord;
}) {
  const [workType, setWorkType] = useState<FeedbackWorkType>("Task");
  const [plan, setPlan] = useState<FeedbackWorkPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const identity = useRef<ConvertCommandIdentity | null>(null);

  function reset() {
    setPlan(null);
    setError(null);
    identity.current = null;
  }
  async function preview() {
    setPending(true);
    reset();
    try {
      setPlan(await onPreview(workType));
    } catch {
      setError("The preview could not be loaded. Reload and try again.");
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
      workId: crypto.randomUUID(),
    };
    setPending(true);
    setError(null);
    try {
      await onConfirm(plan, identity.current);
      identity.current = null;
      onClose();
    } catch {
      setError(
        "The Work could not be created. If the Feedback changed, preview again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Work</DialogTitle>
          <DialogDescription>
            {record.title}. This creates no AI summary, exactly one Work, and
            does not delete or archive the Feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`feedback-work-type-${record.id}`}>Work type</Label>
          <NativeSelect
            disabled={pending}
            id={`feedback-work-type-${record.id}`}
            onChange={(event) => {
              setWorkType(event.target.value as FeedbackWorkType);
              reset();
            }}
            value={workType}
          >
            {FEEDBACK_WORK_TYPES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {plan ? <ConvertToWorkPreview plan={plan} /> : null}
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
