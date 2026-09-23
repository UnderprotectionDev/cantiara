import type {
  ApplyRecordActionInput,
  PreviewRecordActionInput,
  RecordAction,
  RecordActionPreview,
  RecordActionRuntimeInputs,
  UndoRecordActionInput,
} from "@cantiara/api/record-actions";
import { recordActionStepsNeedRuntimeInputs } from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

interface ActiveRecordAction {
  action: RecordAction;
  work: WorkProfile;
}

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Record Action could not be completed. Try again.";
}

export function useRecordActionRunner(projectId: string) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const actionsQuery = useQuery(
    orpc.recordActions.queryOptions({ input: { projectId } }),
  );
  const [active, setActive] = useState<ActiveRecordAction | null>(null);
  const [runVersion, setRunVersion] = useState(0);
  const needsRuntimeInput = active
    ? recordActionStepsNeedRuntimeInputs(active.action.steps)
    : false;
  const needsRuntimeFieldInput = Boolean(
    active?.action.steps.some(
      (step) =>
        step.kind === "custom-field-value" &&
        step.value.kind === "runtime-input",
    ),
  );
  const needsRuntimeRelationInput = Boolean(
    active?.action.steps.some((step) => step.kind === "related-work"),
  );
  const runtimeCustomFieldsQueryOptions = orpc.customFields.queryOptions({
    input: { projectId },
  });
  const runtimeCustomFieldsQuery = useQuery({
    ...runtimeCustomFieldsQueryOptions,
    enabled: needsRuntimeFieldInput,
  });
  const runtimeWorksQueryOptions = orpc.projectWorks.queryOptions({
    input: { archived: false, projectId },
  });
  const runtimeWorksQuery = useQuery({
    ...runtimeWorksQueryOptions,
    enabled: needsRuntimeRelationInput,
  });
  const [preview, setPreview] = useState<RecordActionPreview | null>(null);
  const [applyCommand, setApplyCommand] =
    useState<ApplyRecordActionInput | null>(null);
  const [applyResult, setApplyResult] = useState<Awaited<
    ReturnType<typeof client.applyRecordAction>
  > | null>(null);
  const [undoCommand, setUndoCommand] = useState<UndoRecordActionInput | null>(
    null,
  );
  const [isPreparingUndo, setIsPreparingUndo] = useState(false);
  const [undoReceipt, setUndoReceipt] = useState<Awaited<
    ReturnType<typeof client.undoRecordAction>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshWork(work: WorkProfile) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
      queryClient.invalidateQueries({
        queryKey: orpc.work.queryOptions({ input: { workId: work.id } })
          .queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.scopeTree.queryOptions({
          input: { projectId: work.projectId },
        }).queryKey,
      }),
    ]);
  }

  const previewMutation = useMutation({
    mutationFn: (input: PreviewRecordActionInput) =>
      client.previewRecordAction(input),
    onError: (mutationError) => setError(mutationErrorMessage(mutationError)),
    onSuccess: (nextPreview) => {
      setError(null);
      setPreview(nextPreview);
    },
  });

  const applyMutation = useMutation({
    mutationFn: (input: ApplyRecordActionInput) =>
      runOnlineOnlyWrite(() => client.applyRecordAction(input)),
    onError: (mutationError) => setError(mutationErrorMessage(mutationError)),
    onSuccess: async (result) => {
      setApplyResult(result);
      setApplyCommand(null);
      setError(null);
      if (result.status === "committed" && active) {
        await refreshWork(active.work);
      }
    },
  });

  const undoMutation = useMutation({
    mutationFn: (input: UndoRecordActionInput) =>
      runOnlineOnlyWrite(() => client.undoRecordAction(input)),
    onError: (mutationError) => setError(mutationErrorMessage(mutationError)),
    onSuccess: async (receipt) => {
      setUndoReceipt(receipt);
      setUndoCommand(null);
      setError(null);
      if (active) {
        await refreshWork(active.work);
      }
    },
  });

  function start(action: RecordAction, work: WorkProfile) {
    if (connection === "offline" || work.archivedAt !== null) {
      return;
    }
    setActive({ action, work });
    setRunVersion((current) => current + 1);
    setPreview(null);
    setApplyCommand(null);
    setApplyResult(null);
    setUndoCommand(null);
    setUndoReceipt(null);
    setError(null);
    previewMutation.reset();
    applyMutation.reset();
    undoMutation.reset();
    if (!recordActionStepsNeedRuntimeInputs(action.steps)) {
      previewMutation.mutate({
        actionId: action.id,
        runtimeInputs: { customFieldValues: {}, relations: {} },
        workId: work.id,
      });
    }
  }

  function previewWithInputs(runtimeInputs: RecordActionRuntimeInputs) {
    if (!active || connection === "offline" || previewMutation.isPending) {
      return;
    }
    setPreview(null);
    setError(null);
    previewMutation.mutate({
      actionId: active.action.id,
      runtimeInputs,
      workId: active.work.id,
    });
  }

  function changeInputs() {
    if (previewMutation.isPending || applyMutation.isPending) {
      return;
    }
    setPreview(null);
    setApplyCommand(null);
    setError(null);
  }

  function apply() {
    if (
      !(active && preview) ||
      connection === "offline" ||
      active.work.archivedAt !== null ||
      applyMutation.isPending
    ) {
      return;
    }
    const command = applyCommand ?? {
      actionId: preview.actionId,
      actionRevision: preview.actionRevision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: crypto.randomUUID(),
      focusDate: preview.focusDate,
      previewFingerprint: preview.previewFingerprint,
      runtimeInputs: preview.runtimeInputs,
      workId: preview.workId,
    };
    setApplyCommand(command);
    applyMutation.mutate(command);
  }

  async function undo() {
    if (
      !active ||
      applyResult?.status !== "committed" ||
      connection === "offline" ||
      active.work.archivedAt !== null ||
      undoMutation.isPending
    ) {
      return;
    }
    if (undoCommand) {
      undoMutation.mutate(undoCommand);
      return;
    }

    setIsPreparingUndo(true);
    try {
      const currentWork = await client.work({ workId: active.work.id });
      const command: UndoRecordActionInput = {
        baseRevision: currentWork.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        receiptId: applyResult.receipt.id,
        workId: active.work.id,
      };
      setUndoCommand(command);
      undoMutation.mutate(command);
    } catch (mutationError) {
      setError(mutationErrorMessage(mutationError));
    } finally {
      setIsPreparingUndo(false);
    }
  }

  function close() {
    if (applyMutation.isPending || undoMutation.isPending) {
      return;
    }
    setActive(null);
    setPreview(null);
    setApplyCommand(null);
    setApplyResult(null);
    setUndoCommand(null);
    setUndoReceipt(null);
    setError(null);
    previewMutation.reset();
    applyMutation.reset();
    undoMutation.reset();
  }

  return {
    actions: actionsQuery.data ?? [],
    actionsError: actionsQuery.isError,
    active,
    apply,
    applyError: applyMutation.isError,
    applyResult,
    close,
    changeInputs,
    error,
    isApplying: applyMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isPreparingUndo,
    isUndoing: isPreparingUndo || undoMutation.isPending,
    needsRuntimeInput,
    preview,
    previewWithInputs,
    runVersion,
    runtimeCustomFields:
      runtimeCustomFieldsQuery.data?.filter(
        (definition) => definition.trashedAt === null,
      ) ?? [],
    runtimeCustomFieldsError: runtimeCustomFieldsQuery.isError,
    runtimeCustomFieldsPending: runtimeCustomFieldsQuery.isPending,
    runtimeWorks: runtimeWorksQuery.data ?? [],
    runtimeWorksError: runtimeWorksQuery.isError,
    runtimeWorksPending: runtimeWorksQuery.isPending,
    start,
    undo,
    undoError: undoMutation.isError,
    undoReceipt,
  };
}

export type RecordActionRunnerState = ReturnType<typeof useRecordActionRunner>;
