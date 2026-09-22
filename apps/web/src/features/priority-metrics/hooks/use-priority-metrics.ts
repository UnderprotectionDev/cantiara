import type {
  CreatePriorityMetricInput,
  PriorityMetric,
  PriorityMetricProjectValues,
  PriorityMetricValue,
  PriorityMetricValueListItem,
  UpdatePriorityMetricInput,
} from "@cantiara/api/priority-metrics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export interface UpdatePriorityMetricArgs extends UpdatePriorityMetricInput {
  baseRevision: number;
  metricId: string;
}

export interface PriorityMetricRevisionArgs {
  baseRevision: number;
  metricId: string;
}

export interface SetPriorityMetricValueArgs {
  baseRevision: number;
  metricId: string;
  rank: PriorityMetricValue["rank"];
  workId: string;
}

export interface ClearPriorityMetricValueArgs {
  baseRevision: number;
  metricId: string;
  workId: string;
}

function usePriorityMetricInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.priorityMetrics.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.priorityMetricProjectValues.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.priorityMetricValues.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.workContext.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.priorityMetrics.queryOptions({
          input: { projectId },
        }).queryKey,
      }),
    ]);
  };
}

export function usePriorityMetrics(projectId: string) {
  const invalidate = usePriorityMetricInvalidation(projectId);
  const query = useQuery(
    orpc.priorityMetrics.queryOptions({ input: { projectId } }),
  );

  const create = useMutation({
    mutationFn: (input: CreatePriorityMetricInput) =>
      runOnlineOnlyWrite(() =>
        client.createPriorityMetric({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: UpdatePriorityMetricArgs) =>
      runOnlineOnlyWrite(() =>
        client.updatePriorityMetric({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  const trash = useMutation({
    mutationFn: (input: PriorityMetricRevisionArgs) =>
      runOnlineOnlyWrite(() =>
        client.trashPriorityMetric({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  });

  return { create, query, trash, update };
}

export function usePriorityMetricProjectValues(projectId: string) {
  const projectValuesQueryOptions =
    orpc.priorityMetricProjectValues.queryOptions({
      input: { projectId },
    });
  const query = useQuery(projectValuesQueryOptions);
  const mutations = usePriorityMetricValueMutations(projectId);
  return { ...mutations, query };
}

export function usePriorityMetricValueMutations(projectId: string) {
  const invalidate = usePriorityMetricInvalidation(projectId);

  const setValue = useMutation({
    mutationFn: (input: SetPriorityMetricValueArgs) =>
      runOnlineOnlyWrite(() =>
        client.setPriorityMetricValue({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onSuccess: invalidate,
  });

  const clearValue = useMutation({
    mutationFn: (input: ClearPriorityMetricValueArgs) =>
      runOnlineOnlyWrite(() =>
        client.clearPriorityMetricValue({
          ...input,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onSuccess: invalidate,
  });

  return { clearValue, setValue };
}

export function priorityMetricItemsForWork(
  projectValues: PriorityMetricProjectValues | undefined,
  workId: string,
): PriorityMetricValueListItem[] {
  if (!projectValues) {
    return [];
  }
  return projectValues.definitions.map((definition) => ({
    definition,
    value:
      projectValues.values.find(
        (candidate) =>
          candidate.metricId === definition.id && candidate.workId === workId,
      ) ?? null,
  }));
}

export function priorityMetricRevision(metric: PriorityMetric) {
  return { baseRevision: metric.revision, metricId: metric.id };
}
