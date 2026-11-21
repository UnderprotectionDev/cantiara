// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the candidate it was made from.
import type { SpecChangeReviewCandidate } from "@cantiara/api/spec-change-review-candidates";
import {
  previewSpecChangeReviewFollowUpInputSchema,
  SPEC_FOLLOW_UP_WORK_TYPES,
  type SpecChangeReviewFollowUpPreview,
  type SpecFollowUpWorkType,
} from "@cantiara/api/spec-change-review-follow-up";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  type DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";

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

interface SpecFollowUpDialogProps {
  candidate: SpecChangeReviewCandidate;
  name: string;
  onConfirm: ConfirmFollowUp;
  onPreview: PreviewFollowUp;
  reviewId: string;
}

export function SpecFollowUpDialog(props: SpecFollowUpDialogProps) {
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
        Create Follow-up Work
      </DialogTrigger>
      <DialogContent>
        <SpecFollowUpContent
          {...props}
          busy={busy}
          onClose={() => actions.current?.close()}
        />
      </DialogContent>
    </Dialog>
  );
}

function SpecFollowUpContent({
  busy,
  candidate,
  name,
  onClose,
  onConfirm,
  onPreview,
  reviewId,
}: SpecFollowUpDialogProps & {
  busy: RefObject<boolean>;
  onClose: () => void;
}) {
  const form = useForm({
    defaultValues: { workType: "Task" as SpecFollowUpWorkType },
    onSubmit: async ({ value, formApi }) => {
      if (!preview || commit.isPending) {
        return;
      }
      const parsed = previewSpecChangeReviewFollowUpInputSchema.safeParse({
        candidate: candidate.identity,
        reviewId,
        workType: value.workType,
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ?? "Check the Follow-up Work.",
            fields: {},
          },
        });
        return;
      }
      identity.current ??= {
        key: crypto.randomUUID(),
        workId: crypto.randomUUID(),
      };
      await commit.mutateAsync([candidate, preview, identity.current]);
    },
  });
  const workType = useSelector(form.store, (state) => state.values.workType);
  const identity = useRef<FollowUpCommandIdentity | null>(null);
  const mounted = useRef<boolean>(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const previewQuery = useQuery({
    ...orpc.previewSpecChangeReviewFollowUp.queryOptions({
      input: {
        candidate: candidate.identity,
        reviewId,
        workType,
      },
    }),
    queryFn: () => onPreview(candidate, workType),
    gcTime: 0,
    retry: false,
  });
  const commit = useMutation({
    meta: { onlineWrite: true },
    mutationFn: (command: Parameters<ConfirmFollowUp>) => onConfirm(...command),
    onSuccess: (_, [, , confirmed]) => {
      if (mounted.current && identity.current === confirmed) {
        onClose();
      }
    },
  });
  const preview = previewQuery.data;
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  const pending =
    previewQuery.status === "pending" || commit.isPending || submitting;
  let error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  if (previewQuery.isError) {
    error = "The preview could not be loaded. Reload and try again.";
  } else if (commit.isError) {
    error =
      "The Work could not be created. If the review changed, preview again.";
  }

  useLayoutEffect(() => {
    busy.current = commit.isPending || submitting;
    return () => {
      busy.current = false;
    };
  }, [busy, commit.isPending, submitting]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Follow-up Work</DialogTitle>
        <DialogDescription>
          {name}. This creates exactly one Work and does not change the review
          status.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!pending) {
            submitForm(form).catch(() => undefined);
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="spec-follow-up-work-type">Work type</Label>
          <NativeSelect
            disabled={pending}
            id="spec-follow-up-work-type"
            onChange={(event) => {
              identity.current = null;
              commit.reset();
              form.setFieldValue(
                "workType",
                event.target.value as SpecFollowUpWorkType,
              );
            }}
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
          <DialogClose
            disabled={commit.isPending || submitting}
            render={<Button variant="outline" />}
          >
            Cancel
          </DialogClose>
          <Button disabled={!preview || pending} type="submit">
            Confirm
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
