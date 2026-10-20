// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the candidate it was made from.
import type { SpecChangeReviewCandidate } from "@cantiara/api/spec-change-review-candidates";
import {
  SPEC_FOLLOW_UP_WORK_TYPES,
  type SpecChangeReviewFollowUpPreview,
  type SpecFollowUpWorkType,
} from "@cantiara/api/spec-change-review-follow-up";
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
import { useEffect, useRef, useState } from "react";

/** Identity of one confirmation attempt; reused on retry so the Work is created once. */
export interface FollowUpCommandIdentity {
  key: string;
  workId: string;
}

export type PreviewFollowUp = (
  candidate: SpecChangeReviewCandidate,
  workType: SpecFollowUpWorkType,
) => Promise<SpecChangeReviewFollowUpPreview>;
export type ConfirmFollowUp = (
  candidate: SpecChangeReviewCandidate,
  preview: SpecChangeReviewFollowUpPreview,
  identity: FollowUpCommandIdentity,
) => Promise<unknown>;

/** Read-only account of the one Work a confirmation would create. */
export function SpecFollowUpPreview({
  preview,
}: {
  preview: SpecChangeReviewFollowUpPreview;
}) {
  const { plan } = preview;
  return (
    <section
      aria-label="Follow-up Work preview"
      className="space-y-2 rounded-md border border-border/70 p-3 text-sm"
    >
      <p>Confirming creates exactly one Work. Nothing exists until then.</p>
      <dl className="grid gap-1">
        <div className="flex gap-2">
          <dt>Title</dt>
          <dd>{plan.work.title}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Work type</dt>
          <dd>{plan.work.type}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Target Project</dt>
          <dd>{plan.targetProject.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Starting status</dt>
          <dd>{plan.work.startingStatus}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Changed spec versions</dt>
          <dd>
            {plan.specVersions.documentTitle}: Version{" "}
            {plan.specVersions.previousRevision} → Version{" "}
            {plan.specVersions.nextRevision}
          </dd>
        </div>
        <div>
          <dt>Why</dt>
          <dd>
            {plan.candidateSource.documentLevel
              ? "Document-level candidate. "
              : null}
            {plan.candidateSource.reasons
              .map(({ detail, kind }) =>
                detail ? `${kind} (${detail})` : kind,
              )
              .join(", ")}
          </dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd className="whitespace-pre-wrap">{plan.work.description}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        The review status of the candidate does not change.
      </p>
    </section>
  );
}

export function SpecFollowUpDialog({
  candidate,
  name,
  onClose,
  onConfirm,
  onPreview,
}: {
  candidate: SpecChangeReviewCandidate;
  name: string;
  onClose: () => void;
  onConfirm: ConfirmFollowUp;
  onPreview: PreviewFollowUp;
}) {
  const [workType, setWorkType] = useState<SpecFollowUpWorkType>("Task");
  const [preview, setPreview] =
    useState<SpecChangeReviewFollowUpPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const identity = useRef<FollowUpCommandIdentity | null>(null);
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  const candidateRef = useRef(candidate);
  candidateRef.current = candidate;

  // The preview is read-only and re-derived for the chosen Work type.
  useEffect(() => {
    let current = true;
    setPending(true);
    setPreview(null);
    setError(null);
    identity.current = null;
    previewRef
      .current(candidateRef.current, workType)
      .then((next) => current && setPreview(next))
      .catch(
        () =>
          current &&
          setError("The preview could not be loaded. Reload and try again."),
      )
      .finally(() => current && setPending(false));
    return () => {
      current = false;
    };
  }, [workType]);

  async function confirm() {
    if (!preview || pending) {
      return;
    }
    identity.current ??= {
      key: crypto.randomUUID(),
      workId: crypto.randomUUID(),
    };
    setPending(true);
    setError(null);
    try {
      await onConfirm(candidate, preview, identity.current);
      identity.current = null;
      onClose();
    } catch {
      setError(
        "The Work could not be created. If the review changed, preview again.",
      );
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Follow-up Work</DialogTitle>
          <DialogDescription>
            {name}. This creates exactly one Work and does not change the review
            status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="spec-follow-up-work-type">Work type</Label>
          <NativeSelect
            disabled={pending}
            id="spec-follow-up-work-type"
            onChange={(event) =>
              setWorkType(event.target.value as SpecFollowUpWorkType)
            }
            value={workType}
          >
            {SPEC_FOLLOW_UP_WORK_TYPES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p aria-live="polite" role="status">
          {pending && !preview ? "Loading preview…" : ""}
        </p>
        {preview ? <SpecFollowUpPreview preview={preview} /> : null}
        {error ? <p role="alert">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!preview || pending}
            onClick={confirm}
            type="button"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
