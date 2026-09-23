import type {
  ApplyRecordActionInput,
  PreviewRecordActionInput,
  RecordAction,
  RecordActionPreview,
  UndoRecordActionInput,
} from "@cantiara/api/record-actions";
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

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    setPreview(null);
    setApplyCommand(null);
    setApplyResult(null);
    setUndoCommand(null);
    setUndoReceipt(null);
    setError(null);
    previewMutation.reset();
    applyMutation.reset();
    undoMutation.reset();
    previewMutation.mutate({
      actionId: action.id,
      focusDate: localDateKey(new Date()),
      workId: work.id,
    });
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
    error,
    isApplying: applyMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isPreparingUndo,
    isUndoing: isPreparingUndo || undoMutation.isPending,
    preview,
    start,
    undo,
    undoError: undoMutation.isError,
    undoReceipt,
  };
}

export type RecordActionRunnerState = ReturnType<typeof useRecordActionRunner>;
