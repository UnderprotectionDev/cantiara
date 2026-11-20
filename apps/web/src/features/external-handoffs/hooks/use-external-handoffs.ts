import type {
  CancelExternalExecutionHandoffInput,
  ConfirmExternalExecutionHandoffReconcileInput,
  ExternalExecutionHandoffInput,
  PreviewExternalExecutionHandoffReconcileInput,
  RecordExternalExecutionHandoffReturnInput,
} from "@cantiara/api/external-handoffs";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { fetchFresh } from "@/lib/fetch-fresh";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export function useExternalExecutionHandoffs(
  work: WorkProfile,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const options = orpc.externalExecutionHandoffs.queryOptions({
    input: { workId: work.id },
  });
  const historyOptions = orpc.externalExecutionHandoffHistory.queryOptions({
    input: { workId: work.id },
  });
  const relatedWorksOptions =
    orpc.externalExecutionHandoffRelatedWorks.queryOptions({
      input: { workId: work.id },
    });
  const query = useQuery({ ...options, enabled });
  const history = useQuery({ ...historyOptions, enabled });
  const relatedWorks = useQuery({ ...relatedWorksOptions, enabled });
  const start = usePreparedMutation(
    orpc.startExternalExecutionHandoff.mutationOptions({
      mutationFn: (input) => client.startExternalExecutionHandoff(input),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: options.queryKey }),
          queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
        ]);
      },
    }),
    (input: Omit<ExternalExecutionHandoffInput, "workId">) => ({
      ...input,
      baseRevision: work.revision,
      workId: work.id,
    }),
  );
  const recordPackageExport = useMutation({
    mutationKey: orpc.recordExternalExecutionHandoffPackageExport.mutationKey(),
    mutationFn: (input: { clientEventId: string; handoffId: string }) =>
      runOnlineOnlyWrite(() =>
        client.recordExternalExecutionHandoffPackageExport(input),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
  });
  const cancel = useMutation({
    mutationKey: orpc.cancelExternalExecutionHandoff.mutationKey(),
    mutationFn: (input: CancelExternalExecutionHandoffInput) =>
      runOnlineOnlyWrite(() => client.cancelExternalExecutionHandoff(input)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
      ]);
    },
  });

  const recordReturn = useMutation({
    mutationKey: orpc.recordExternalExecutionHandoffReturn.mutationKey(),
    mutationFn: (input: RecordExternalExecutionHandoffReturnInput) =>
      runOnlineOnlyWrite(() =>
        client.recordExternalExecutionHandoffReturn(input),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
      ]);
    },
  });

  const previewReconcile = useMutation({
    mutationKey: orpc.previewExternalExecutionHandoffReconcile.mutationKey(),
    mutationFn: (input: PreviewExternalExecutionHandoffReconcileInput) =>
      fetchFresh(queryClient, {
        ...orpc.previewExternalExecutionHandoffReconcile.queryOptions({
          input,
        }),
        gcTime: 0,
      }),
    meta: { presentsSupportFailure: true },
  });

  const confirmReconcile = useMutation({
    mutationKey: orpc.confirmExternalExecutionHandoffReconcile.mutationKey(),
    mutationFn: (input: ConfirmExternalExecutionHandoffReconcileInput) =>
      runOnlineOnlyWrite(() =>
        client.confirmExternalExecutionHandoffReconcile(input),
      ),
    onSuccess: async (result) => {
      const relatedRecordIds = [
        work.id,
        ...(result.reconcileDecision?.createdFollowUpWorks.map(
          ({ id }) => id,
        ) ?? []),
        ...(result.reconcileDecision?.createdRelations.flatMap(
          ({ sourceWorkId, targetWorkId }) => [sourceWorkId, targetWorkId],
        ) ?? []),
      ];
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
        queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
        queryClient.invalidateQueries({
          queryKey: relatedWorksOptions.queryKey,
        }),
        ...relatedRecordIds.flatMap((recordId) => [
          queryClient.invalidateQueries({
            queryKey: orpc.relations.queryOptions({
              input: { recordId, recordType: "Work" },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.usedIn.queryOptions({
              input: { recordId, recordType: "Work" },
            }).queryKey,
          }),
        ]),
      ]);
    },
  });

  return {
    cancel,
    confirmReconcile,
    history,
    previewReconcile,
    query,
    recordPackageExport,
    recordReturn,
    relatedWorks,
    start,
  };
}
