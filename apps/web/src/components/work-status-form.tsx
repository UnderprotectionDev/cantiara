// biome-ignore-all lint/performance/noJsxPropsBind: Work status controls close over their current Work state.

import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  closeWorkInputSchema,
  WORK_CLOSURE_RESULT_OPTIONS,
  WORK_STATUS_OPTIONS,
  type WorkClosePreview,
  type WorkClosureResult,
  type WorkOpenStatus,
  type WorkProfile,
  type WorkStatus,
} from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import WorkCompletionFeedback from "@/components/work-completion-feedback";
import type {
  UserInitiatedWorkCloseOutcome,
  WorkCompletionFeedbackState,
} from "@/features/completion-effects/hooks/use-user-initiated-work-success";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work status could not be changed. Try again.";
}

function hasClosureWarnings(preview: WorkClosePreview) {
  return (
    preview.closureCheck.activeBlockers.length > 0 ||
    preview.closureCheck.incompleteChecklistItems.length > 0
  );
}

export function getWorkStatusLabel(
  status: WorkStatus,
  labels: readonly WorkStatusLabel[],
) {
  return labels.find(({ semantic }) => semantic === status)?.label ?? status;
}

export interface WorkStatusActionRequest {
  id: string;
  status: WorkStatus;
  workId: string;
}

export default function WorkStatusForm({
  completionFeedback,
  onCloseOutcome,
  onRequestedStatusActionHandled,
  requestedStatusAction,
  work,
  workStatusLabels,
}: {
  completionFeedback: WorkCompletionFeedbackState;
  onCloseOutcome: (outcome: UserInitiatedWorkCloseOutcome) => void;
  onRequestedStatusActionHandled: (requestId: string) => void;
  requestedStatusAction: Pick<WorkStatusActionRequest, "id" | "status"> | null;
  work: WorkProfile;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const latestWorkRevision = useRef(work.revision);
  const [reopenTarget, setReopenTarget] = useState<WorkOpenStatus | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const pendingCloseRequest = useRef<{
    fingerprint: string;
    clientIdempotencyKey: string;
    visibleAtCloseStart: boolean;
  } | null>(null);
  const handledStatusActionRequestId = useRef<string | null>(null);
  const pendingCloseOpenStatus = useRef<WorkOpenStatus | null>(null);
  const worksQueryKey = orpc.projectWorks.queryOptions({
    input: { projectId: work.projectId },
  }).queryKey;
  const workQueryKey = orpc.work.queryOptions({
    input: { workId: work.id },
  }).queryKey;
  const scopeTreeQueryKey = orpc.scopeTree.queryOptions({
    input: { projectId: work.projectId },
  }).queryKey;

  useEffect(() => {
    if (work.revision < latestWorkRevision.current) {
      return;
    }
    latestWorkRevision.current = work.revision;
    setReopenTarget(null);
  }, [work.revision]);

  async function refreshWork() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: worksQueryKey }),
      queryClient.invalidateQueries({ queryKey: workQueryKey }),
      queryClient.invalidateQueries({ queryKey: scopeTreeQueryKey }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
  }

  const updateStatus = useMutation({
    mutationKey: orpc.updateWorkStatus.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (input: Parameters<typeof client.updateWorkStatus>[0]) =>
      client.updateWorkStatus(input),
    onSuccess: async (updatedWork) => {
      latestWorkRevision.current = updatedWork.revision;
      await refreshWork();
    },
  });

  const previewClose = useMutation({
    mutationKey: orpc.workClosePreview.mutationKey(),
    mutationFn: (input: { workId: string; revision: number }) =>
      client.workClosePreview({ workId: input.workId }),
  });

  const closeWork = useMutation({
    mutationKey: orpc.closeWork.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (input: Parameters<typeof client.closeWork>[0]) =>
      client.closeWork(input),
    onError: (_, input) => {
      if (input.closureResult === "Completed") {
        onCloseOutcome({
          clientIdempotencyKey: input.clientIdempotencyKey,
          closureResult: input.closureResult,
          kind: "failed",
          workId: work.id,
        });
      }
    },
    onSuccess: async (closedWork, input) => {
      latestWorkRevision.current = closedWork.revision;
      if (closedWork.closureResult === "Completed") {
        const visibleAtCloseStart =
          pendingCloseRequest.current?.clientIdempotencyKey ===
            input.clientIdempotencyKey &&
          pendingCloseRequest.current.visibleAtCloseStart;
        const reopenStatus =
          pendingCloseOpenStatus.current ??
          (work.status === "Closed" ? "In Progress" : work.status);
        onCloseOutcome({
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "completed",
          reopenStatus: reopenStatus as WorkOpenStatus,
          visibleAtCloseStart,
          workId: work.id,
        });
      }
      pendingCloseOpenStatus.current = null;
      await refreshWork();
    },
  });

  const reopenWork = useMutation({
    mutationKey: orpc.reopenWork.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (input: Parameters<typeof client.reopenWork>[0]) =>
      client.reopenWork(input),
    onSuccess: async (reopenedWork) => {
      latestWorkRevision.current = reopenedWork.revision;
      setReopenTarget(null);
      await refreshWork();
    },
  });
  const [latest] = [work, updateStatus.data, closeWork.data, reopenWork.data]
    .filter((record) => record !== undefined)
    .sort((first, second) => second.revision - first.revision);
  const selectedStatus = latest?.status ?? work.status;
  const closePreview =
    previewClose.variables?.revision === latestWorkRevision.current &&
    !closeWork.isSuccess
      ? previewClose.data
      : undefined;
  const mutationError =
    closeWork.error ??
    reopenWork.error ??
    previewClose.error ??
    updateStatus.error;
  const error =
    validationError ??
    (mutationError ? mutationErrorMessage(mutationError) : null);
  const { reset: resetUpdate } = updateStatus;
  const { reset: resetPreview } = previewClose;
  const { reset: resetClose } = closeWork;
  const { reset: resetReopen } = reopenWork;

  const closeForm = useForm({
    defaultValues: {
      closureResult: "" as WorkClosureResult | "",
      reason: "",
    },
    onSubmit: async ({ value }) => {
      if (!(closePreview && value.closureResult)) {
        return;
      }
      const request = {
        baseRevision: latestWorkRevision.current,
        ...(hasClosureWarnings(closePreview)
          ? { closureCheck: "Close anyway" as const }
          : {}),
        closureResult: value.closureResult,
        reason: value.reason,
        workId: work.id,
      };
      const fingerprint = JSON.stringify(request);
      const pending = pendingCloseRequest.current;
      const isRetry = pending?.fingerprint === fingerprint;
      if (!isRetry) {
        pendingCloseOpenStatus.current =
          work.status === "Closed" ? null : (work.status as WorkOpenStatus);
      }
      const clientIdempotencyKey = isRetry
        ? pending.clientIdempotencyKey
        : crypto.randomUUID();
      const closeInput = closeWorkInputSchema.safeParse({
        ...request,
        clientIdempotencyKey,
      });
      if (!closeInput.success) {
        setValidationError(
          closeInput.error.issues[0]?.message ?? mutationErrorMessage(null),
        );
        return;
      }
      pendingCloseRequest.current = {
        clientIdempotencyKey,
        fingerprint,
        visibleAtCloseStart: isRetry
          ? pending.visibleAtCloseStart
          : document.visibilityState === "visible",
      };
      await closeWork.mutateAsync({
        ...request,
        clientIdempotencyKey,
      });
      pendingCloseRequest.current = null;
      closeForm.reset();
    },
  });

  const cancelTransition = useCallback(() => {
    resetPreview();
    resetClose();
    resetReopen();
    resetUpdate();
    setReopenTarget(null);
    setValidationError(null);
    pendingCloseRequest.current = null;
    pendingCloseOpenStatus.current = null;
    closeForm.reset();
  }, [closeForm, resetClose, resetPreview, resetReopen, resetUpdate]);

  const handleStatusChange = useCallback(
    (nextStatus: WorkStatus) => {
      setValidationError(null);
      if (nextStatus === work.status) {
        cancelTransition();
        return;
      }
      if (work.status === "Closed") {
        setReopenTarget(nextStatus as WorkOpenStatus);
        return;
      }
      if (nextStatus === "Closed") {
        resetClose();
        resetUpdate();
        previewClose.mutate({
          workId: work.id,
          revision: latestWorkRevision.current,
        });
        return;
      }
      updateStatus.mutate(
        commandVariables(
          {
            baseRevision: latestWorkRevision.current,
            status: nextStatus,
            workId: work.id,
          },
          updateStatus.isError ? updateStatus.variables : undefined,
        ),
      );
    },
    [
      cancelTransition,
      previewClose.mutate,
      resetClose,
      resetUpdate,
      updateStatus.isError,
      updateStatus.variables,
      updateStatus.mutate,
      work.id,
      work.status,
    ],
  );

  useEffect(() => {
    if (
      !requestedStatusAction ||
      handledStatusActionRequestId.current === requestedStatusAction.id
    ) {
      return;
    }

    handledStatusActionRequestId.current = requestedStatusAction.id;
    onRequestedStatusActionHandled(requestedStatusAction.id);
    handleStatusChange(requestedStatusAction.status);
  }, [
    handleStatusChange,
    onRequestedStatusActionHandled,
    requestedStatusAction,
  ]);

  function handleCloseSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    closeForm.handleSubmit().catch(() => undefined);
  }

  function confirmReopen() {
    if (!reopenTarget) {
      return;
    }
    reopenWork.mutate(
      commandVariables<
        Omit<Parameters<typeof client.reopenWork>[0], "clientIdempotencyKey">
      >(
        {
          baseRevision: latestWorkRevision.current,
          confirmed: true,
          status: reopenTarget,
          workId: work.id,
        },
        reopenWork.isError ? reopenWork.variables : undefined,
      ),
    );
  }

  const isPending =
    updateStatus.isPending ||
    previewClose.isPending ||
    closeWork.isPending ||
    reopenWork.isPending;

  return (
    <div className="flex min-w-44 flex-col items-start gap-1">
      <label
        className="text-xs text-muted-foreground"
        htmlFor={`work-status-${work.id}`}
      >
        Status
      </label>
      <NativeSelect
        aria-label={`Status for ${work.key}`}
        className="w-full"
        disabled={connection === "offline" || isPending}
        id={`work-status-${work.id}`}
        onChange={(event) =>
          handleStatusChange(event.target.value as WorkStatus)
        }
        value={selectedStatus}
      >
        {WORK_STATUS_OPTIONS.map((status) => (
          <NativeSelectOption key={status} value={status}>
            {getWorkStatusLabel(status, workStatusLabels)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {work.closureResult ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary">{work.closureResult}</Badge>
          {work.closureReason ? (
            <span className="text-xs text-muted-foreground">
              {work.closureReason}
            </span>
          ) : null}
        </div>
      ) : null}
      <WorkCompletionNotice
        completionFeedback={completionFeedback}
        isPending={isPending}
        setReopenTarget={setReopenTarget}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {closePreview ? (
        <form
          aria-label={`Close ${work.key}`}
          className="w-full space-y-3 rounded-md border bg-muted/20 p-3 text-left"
          onSubmit={handleCloseSubmit}
          role="dialog"
        >
          {hasClosureWarnings(closePreview) ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Closure check</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {closePreview.closureCheck.incompleteChecklistItems.map(
                  (item) => (
                    <li key={item.id}>{item.label}</li>
                  ),
                )}
                {closePreview.closureCheck.activeBlockers.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <closeForm.Field name="closureResult">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`closure-result-${work.id}`}>
                  Closure result
                </FieldLabel>
                <NativeSelect
                  aria-label={`Closure result for ${work.key}`}
                  id={`closure-result-${work.id}`}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as WorkClosureResult | "",
                    )
                  }
                  required
                  value={field.state.value}
                >
                  <NativeSelectOption disabled value="">
                    Closure result
                  </NativeSelectOption>
                  {WORK_CLOSURE_RESULT_OPTIONS.map((result) => (
                    <NativeSelectOption key={result} value={result}>
                      {result}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </closeForm.Field>
          <closeForm.Field name="reason">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`closure-reason-${work.id}`}>
                  Reason
                </FieldLabel>
                <Textarea
                  aria-label={`Reason for ${work.key}`}
                  id={`closure-reason-${work.id}`}
                  maxLength={2000}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </closeForm.Field>
          {closePreview.lastingContext ? (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">
                Keep lasting context
              </summary>
              <p className="mt-2 text-muted-foreground">
                Preview a Decision or Personal Wiki command. No text is
                generated, and closing does not wait for either command.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {closePreview.lastingContext.sources.map((source) => (
                  <li key={source.id}>{source.label}</li>
                ))}
              </ul>
              <p className="mt-2">Decision · Personal Wiki</p>
            </details>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={cancelTransition}
              size="xs"
              type="button"
              variant="outline"
            >
              Return to work
            </Button>
            <Button disabled={closeWork.isPending} size="xs" type="submit">
              {hasClosureWarnings(closePreview) ? "Close anyway" : "Close"}
            </Button>
          </div>
        </form>
      ) : null}
      {reopenTarget ? (
        <div
          aria-label={`Reopen ${work.key}`}
          className="w-full space-y-3 rounded-md border bg-muted/20 p-3 text-left text-xs"
          role="dialog"
        >
          <p>
            Reopen as <span className="font-medium">{reopenTarget}</span>? The
            previous closure result stays in history.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={cancelTransition}
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={reopenWork.isPending}
              onClick={confirmReopen}
              size="xs"
              type="button"
            >
              Confirm reopen
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkCompletionNotice({
  completionFeedback,
  setReopenTarget,
  isPending,
}: {
  completionFeedback: WorkCompletionFeedbackState;
  setReopenTarget: import("react").Dispatch<
    import("react").SetStateAction<
      "Not Started" | "In Progress" | "Blocked" | null
    >
  >;
  isPending: boolean;
}) {
  return completionFeedback.noticeVisible ? (
    <WorkCompletionFeedback
      effectPlaying={completionFeedback.effect !== null}
      onReopen={() => {
        if (completionFeedback.reopenStatus) {
          setReopenTarget(completionFeedback.reopenStatus);
        }
      }}
      palette={completionFeedback.effect?.palette ?? "Haze"}
      reopenDisabled={isPending}
      theme={completionFeedback.effect?.theme ?? "Calm"}
    />
  ) : null;
}
