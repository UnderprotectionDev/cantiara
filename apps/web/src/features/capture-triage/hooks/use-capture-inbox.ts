import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useClientShell } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  accountPreferencesQueryOptions,
  captureInboxQueryOptions,
  client,
} from "@/utils/orpc";

import {
  triageErrorMessage,
  type UndoPreviewState,
} from "../lib/capture-inbox";

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
  const [undoPreview, setUndoPreview] = useState<UndoPreviewState | null>(null);
  const undoMerge = useMutation({
    mutationFn: (input: {
      itemId: string;
      mergeId: string;
      previewId: string;
    }) =>
      shell.runWrite(() =>
        client.undoCaptureMerge({
          clientIdempotencyKey: crypto.randomUUID(),
          mergeId: input.mergeId,
          previewId: input.previewId,
        }),
      ),
    onError: () => toast.error(triageErrorMessage()),
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
      onRestored(input.itemId);
      setUndoPreview(null);
      toast.success("Capture restored.");
    },
  });

  const cancelUndo = useCallback(() => setUndoPreview(null), []);
  const confirmUndo = useCallback(() => {
    if (!undoPreview) {
      return;
    }

    undoMerge.mutate({
      itemId: undoPreview.preview.itemId,
      mergeId: undoPreview.mergeId,
      previewId: undoPreview.preview.previewId,
    });
  }, [undoMerge, undoPreview]);

  return {
    cancelUndo,
    confirmUndo,
    isPending: undoMerge.isPending,
    setUndoPreview,
    undoPreview,
  };
}
