// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current Work state.

import type {
  WorkChecklistConversionPreview,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import WorkChecklist from "./work-checklist";

function checklistMutationErrorMessage(
  error: unknown,
  fallback = "Checklist could not be saved. Try again.",
) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function WorkChecklistEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pendingConversion = useRef<{
    clientIdempotencyKey: string;
    previewId: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (checklist: WorkProfile["checklist"]) =>
      runOnlineOnlyWrite(() =>
        client.updateWorkChecklist({
          baseRevision: work.revision,
          checklist,
          clientIdempotencyKey: crypto.randomUUID(),
          workId: work.id,
        }),
      ),
    onError: (mutationError) => {
      setError(checklistMutationErrorMessage(mutationError));
    },
    onSuccess: (updatedWork) => {
      setError(null);
      for (const archived of [work.archivedAt !== null, "all" as const]) {
        queryClient.setQueryData<WorkProfile[]>(
          orpc.projectWorks.queryOptions({
            input: { archived, projectId: work.projectId },
          }).queryKey,
          (current) =>
            current?.map((item) =>
              item.id === updatedWork.id ? updatedWork : item,
            ),
        );
      }
      queryClient.setQueryData(
        orpc.work.queryOptions({ input: { workId: work.id } }).queryKey,
        updatedWork,
      );
    },
  });
  const previewConversionMutation = useMutation({
    mutationFn: (itemId: string) =>
      client.workChecklistConversionPreview({
        itemId,
        workId: work.id,
      }),
    onError: (mutationError) => {
      setError(
        checklistMutationErrorMessage(
          mutationError,
          "Conversion preview could not be loaded. Try again.",
        ),
      );
    },
    onSuccess: () => {
      setError(null);
      pendingConversion.current = null;
    },
  });
  const conversionMutation = useMutation({
    mutationFn: (preview: WorkChecklistConversionPreview) => {
      const pending = pendingConversion.current;
      const clientIdempotencyKey =
        pending?.previewId === preview.previewId
          ? pending.clientIdempotencyKey
          : crypto.randomUUID();
      pendingConversion.current = {
        clientIdempotencyKey,
        previewId: preview.previewId,
      };
      return runOnlineOnlyWrite(() =>
        client.convertWorkChecklistItem({
          baseRevision: preview.sourceWork.revision,
          clientIdempotencyKey,
          itemId: preview.item.id,
          previewId: preview.previewId,
          workId: preview.sourceWork.id,
        }),
      );
    },
    onError: (mutationError) => {
      setError(
        checklistMutationErrorMessage(
          mutationError,
          "Work could not be converted. Try again.",
        ),
      );
    },
    onSuccess: async (result) => {
      pendingConversion.current = null;
      setError(null);
      for (const archived of [work.archivedAt !== null, "all" as const]) {
        queryClient.setQueryData<WorkProfile[]>(
          orpc.projectWorks.queryOptions({
            input: { archived, projectId: work.projectId },
          }).queryKey,
          (current) => {
            if (!current) {
              return current;
            }
            const withoutSource = current.filter(
              (candidate) =>
                candidate.id !== result.sourceWork.id &&
                candidate.id !== result.work.id,
            );
            return [...withoutSource, result.sourceWork, result.work].sort(
              (left, right) => left.number - right.number,
            );
          },
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectWorksQueryPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.work.queryOptions({
            input: { workId: result.sourceWork.id },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.work.queryOptions({
            input: { workId: result.work.id },
          }).queryKey,
        }),
      ]);
    },
  });

  return (
    <div className="space-y-1">
      <WorkChecklist
        checklist={work.checklist}
        disabled={
          connection === "offline" ||
          mutation.isPending ||
          previewConversionMutation.isPending ||
          conversionMutation.isPending ||
          work.archivedAt !== null
        }
        onConfirmConvert={(preview) => conversionMutation.mutateAsync(preview)}
        onPreviewConvert={(itemId) =>
          previewConversionMutation.mutateAsync(itemId)
        }
        onSave={(checklist) => mutation.mutateAsync(checklist)}
        workKey={work.key}
      />
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
