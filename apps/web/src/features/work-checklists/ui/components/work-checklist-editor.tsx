// biome-ignore-all lint/performance/noJsxPropsBind: Checklist controls close over their current Work state.

import type {
  WorkChecklistConversionPreview,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import WorkChecklist from "../forms/work-checklist-form";

function checklistMutationErrorMessage(
  error: unknown,
  fallback = "Checklist could not be saved. Try again.",
) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function WorkChecklistEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const mutation = usePreparedMutation(
    orpc.updateWorkChecklist.mutationOptions({
      mutationFn: (input) => client.updateWorkChecklist(input),
      onSuccess: (updatedWork) => {
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
    }),
    (checklist: WorkProfile["checklist"]) => ({
      baseRevision: work.revision,
      checklist,
      workId: work.id,
    }),
  );
  const activeConversion = useRef<string | null>(null);
  const previewConversionMutation = useMutation({
    mutationKey: orpc.workChecklistConversionPreview.mutationKey(),
    mutationFn: (itemId: string) =>
      client.workChecklistConversionPreview({ itemId, workId: work.id }),
  });
  const conversionMutation = usePreparedMutation(
    orpc.convertWorkChecklistItem.mutationOptions({
      mutationFn: (input) => client.convertWorkChecklistItem(input),
      onSuccess: async (result, input) => {
        if (activeConversion.current === input.previewId) {
          previewConversionMutation.reset();
          activeConversion.current = null;
        }
        for (const archived of [
          result.sourceWork.archivedAt !== null,
          "all" as const,
        ]) {
          queryClient.setQueryData<WorkProfile[]>(
            orpc.projectWorks.queryOptions({
              input: { archived, projectId: result.sourceWork.projectId },
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
            queryKey: orpc.projectWorks.queryKey({
              input: { projectId: result.sourceWork.projectId },
            }),
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
    }),
    (preview: WorkChecklistConversionPreview) => ({
      baseRevision: preview.sourceWork.revision,
      itemId: preview.item.id,
      previewId: preview.previewId,
      workId: preview.sourceWork.id,
    }),
  );
  const previewError = previewConversionMutation.isError
    ? checklistMutationErrorMessage(
        previewConversionMutation.error,
        "Conversion preview could not be loaded. Try again.",
      )
    : null;
  const conversionError = conversionMutation.isError
    ? checklistMutationErrorMessage(
        conversionMutation.error,
        "Work could not be converted. Try again.",
      )
    : previewError;
  const error = mutation.isError
    ? checklistMutationErrorMessage(mutation.error)
    : conversionError;

  return (
    <div className="space-y-1">
      <WorkChecklist
        checklist={work.checklist}
        conversionItemId={
          previewConversionMutation.isPending ||
          previewConversionMutation.isSuccess
            ? (previewConversionMutation.variables ?? null)
            : null
        }
        conversionPending={
          previewConversionMutation.isPending || conversionMutation.isPending
        }
        conversionPreview={previewConversionMutation.data}
        disabled={
          connection === "offline" ||
          mutation.isPending ||
          previewConversionMutation.isPending ||
          conversionMutation.isPending ||
          work.archivedAt !== null
        }
        onCancelConvert={() => {
          activeConversion.current = null;
          previewConversionMutation.reset();
          conversionMutation.reset();
        }}
        onConfirmConvert={(preview) => {
          activeConversion.current = preview.previewId;
          return conversionMutation.mutateAsync(preview);
        }}
        onPreviewConvert={(itemId) => {
          activeConversion.current = null;
          mutation.reset();
          conversionMutation.reset();
          previewConversionMutation.mutate(itemId);
        }}
        onSave={(checklist) => {
          previewConversionMutation.reset();
          conversionMutation.reset();
          return mutation.mutateAsync(checklist);
        }}
        workKey={work.key}
      />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
