import type {
  CreatePriorityMetricInput,
  PriorityMetric,
  PriorityMetricProjectValues,
  PriorityMetricValue,
  PriorityMetricValueListItem,
  UpdatePriorityMetricInput,
} from "@cantiara/api/priority-metrics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";

export interface UpdatePriorityMetricArgs extends UpdatePriorityMetricInput {
  baseRevision: number;
  metricId: string;
}

export interface PriorityMetricRevisionArgs {
  baseRevision: number;
  metricId: string;
}

export interface DeletePriorityMetricArgs extends PriorityMetricRevisionArgs {
  grant: string;
  projectId: string;
  typedProjectName: string;
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
        queryKey: orpc.priorityMetricTrashImpactPreview.key(),
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

  const create = usePreparedMutation(
    orpc.createPriorityMetric.mutationOptions({
      mutationFn: (input) => client.createPriorityMetric(input),
      onSuccess: invalidate,
    }),
    (input: CreatePriorityMetricInput) => ({
      ...input,
      baseRevision: 0,
    }),
  );

  const update = usePreparedMutation(
    orpc.updatePriorityMetric.mutationOptions({
      mutationFn: (input) => client.updatePriorityMetric(input),
      onSuccess: invalidate,
    }),
    (input: UpdatePriorityMetricArgs) => ({
      ...input,
    }),
  );

  const trash = usePreparedMutation(
    orpc.trashPriorityMetric.mutationOptions({
      mutationFn: (input) => client.trashPriorityMetric(input),
      onSuccess: invalidate,
    }),
    (input: PriorityMetricRevisionArgs) => ({
      ...input,
    }),
  );

  const restore = usePreparedMutation(
    orpc.restorePriorityMetric.mutationOptions({
      mutationFn: (input) => client.restorePriorityMetric(input),
      onSuccess: invalidate,
    }),
    (input: PriorityMetricRevisionArgs) => ({
      ...input,
    }),
  );

  const deletePermanently = usePreparedMutation(
    orpc.deletePriorityMetric.mutationOptions({
      mutationFn: (input) => client.deletePriorityMetric(input),
      onSuccess: invalidate,
    }),
    (input: DeletePriorityMetricArgs) => ({
      ...input,
    }),
  );

  return { create, deletePermanently, query, restore, trash, update };
}

export function usePriorityMetricTrashImpactPreview(metricId: string | null) {
  const options = orpc.priorityMetricTrashImpactPreview.queryOptions({
    input: { metricId: metricId ?? "" },
  });
  return useQuery({ ...options, enabled: metricId !== null });
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

  const setValue = usePreparedMutation(
    orpc.setPriorityMetricValue.mutationOptions({
      mutationFn: (input) => client.setPriorityMetricValue(input),
      onSuccess: invalidate,
    }),
    (input: SetPriorityMetricValueArgs) => ({
      ...input,
      projectId,
    }),
  );

  const clearValue = usePreparedMutation(
    orpc.clearPriorityMetricValue.mutationOptions({
      mutationFn: (input) => client.clearPriorityMetricValue(input),
      onSuccess: invalidate,
    }),
    (input: ClearPriorityMetricValueArgs) => ({
      ...input,
      projectId,
    }),
  );

  return { clearValue, setValue };
}

export function priorityMetricItemsForWork(
  projectValues: PriorityMetricProjectValues | undefined,
  workId: string,
): PriorityMetricValueListItem[] {
  if (!projectValues) {
    return [];
  }
  return projectValues.definitions.map((definition) => {
    const value =
      projectValues.values.find(
        (candidate) =>
          candidate.metricId === definition.id && candidate.workId === workId,
      ) ?? null;
    const valueRevision =
      projectValues.valueRevisions.find(
        (candidate) =>
          candidate.metricId === definition.id && candidate.workId === workId,
      )?.revision ??
      value?.revision ??
      0;
    return { definition, value, valueRevision };
  });
}

export function priorityMetricRevision(metric: PriorityMetric) {
  return { baseRevision: metric.revision, metricId: metric.id };
}
