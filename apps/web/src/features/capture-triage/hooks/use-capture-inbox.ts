import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useClientShell } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import {
  accountPreferencesQueryOptions,
  captureInboxQueryOptions,
  client,
  orpc,
} from "@/utils/orpc";

import { triageErrorMessage } from "../lib/capture-inbox";

export function useCaptureInboxData(accountId: string) {
  const inbox = useQuery(captureInboxQueryOptions(accountId));
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );

  return { accountPreferences, inbox };
}

export function useCaptureInboxUndo(
  accountId: string,
  onRestored: (itemId: string) => void,
) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const selectedMergeId = useRef<string | null>(null);
  const previewUndo = useMutation({
    mutationKey: orpc.previewCaptureMergeUndo.mutationKey(),
    mutationFn: (mergeId: string) =>
      shell.runOnlineOnly(() => client.previewCaptureMergeUndo({ mergeId })),
    onError: (_, mergeId) => {
      if (selectedMergeId.current === mergeId) {
        toast.error(triageErrorMessage());
      }
    },
  });
  const { mutate: loadUndoPreview, reset: resetUndoPreview } = previewUndo;
  const cancelUndo = useCallback(() => {
    selectedMergeId.current = null;
    resetUndoPreview();
  }, [resetUndoPreview]);
  const showUndoPreview = useCallback(
    (mergeId: string) => {
      selectedMergeId.current = mergeId;
      loadUndoPreview(mergeId);
    },
    [loadUndoPreview],
  );
  const undoMerge = useMutation({
    mutationKey: orpc.undoCaptureMerge.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      itemId: _,
      ...input
    }: {
      clientIdempotencyKey: string;
      itemId: string;
      mergeId: string;
      previewId: string;
    }) => client.undoCaptureMerge(input),
    onError: () => toast.error(triageErrorMessage()),
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
      onRestored(input.itemId);
      if (selectedMergeId.current === input.mergeId) {
        cancelUndo();
      }
      toast.success("Capture restored.");
    },
  });

  const undoPreview = previewUndo.data;
  const previewMergeId = previewUndo.variables;
  const confirmUndo = useCallback(() => {
    if (!(undoPreview && previewMergeId)) {
      return;
    }

    undoMerge.mutate(
      commandVariables(
        {
          itemId: undoPreview.itemId,
          mergeId: previewMergeId,
          previewId: undoPreview.previewId,
        },
        undoMerge.isError ? undoMerge.variables : undefined,
      ),
    );
  }, [previewMergeId, undoMerge, undoPreview]);

  return {
    cancelUndo,
    confirmUndo,
    isPending: undoMerge.isPending,
    showUndoPreview,
    undoPreview,
  };
}
