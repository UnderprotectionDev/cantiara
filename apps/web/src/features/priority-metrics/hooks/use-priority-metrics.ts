import type {
  CreatePriorityMetricInput,
  PriorityMetric,
  PriorityMetricProjectValues,
  PriorityMetricValue,
  PriorityMetricValueListItem,
  UpdatePriorityMetricInput,
} from "@cantiara/api/priority-metrics";
import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function usePriorityMetricInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return async ({
    metricId,
    projectId: affectedProjectId = projectId,
    workId,
  }: {
    metricId: string;
    projectId?: string;
    workId?: string;
  }) => {
    const keys: QueryKey[] = [
      orpc.priorityMetricProjectValues.queryKey({
        input: { projectId: affectedProjectId },
      }),
      orpc.priorityMetricTrashImpactPreview.queryKey({ input: { metricId } }),
    ];
    if (workId) {
      keys.push(
        orpc.priorityMetricValues.queryKey({ input: { workId } }),
        orpc.workContext.queryKey({ input: { workId } }),
      );
    } else {
      keys.push(
        orpc.priorityMetrics.queryKey({
          input: { projectId: affectedProjectId },
        }),
        orpc.priorityMetricValues.key(),
        orpc.workContext.key(),
      );
    }
    await Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
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
      onSuccess: (metric) => invalidate({ metricId: metric.id }),
    }),
    (input: CreatePriorityMetricInput) => ({
      ...input,
      baseRevision: 0,
    }),
  );

  const update = usePreparedMutation(
    orpc.updatePriorityMetric.mutationOptions({
      mutationFn: (input) => client.updatePriorityMetric(input),
      onSuccess: (_, input) => invalidate(input),
    }),
    (input: UpdatePriorityMetricArgs) => ({
      ...input,
    }),
  );

  const trash = usePreparedMutation(
    orpc.trashPriorityMetric.mutationOptions({
      mutationFn: (input) => client.trashPriorityMetric(input),
      onSuccess: (_, input) => invalidate(input),
    }),
    (input: PriorityMetricRevisionArgs) => ({
      ...input,
    }),
  );

  const restore = usePreparedMutation(
    orpc.restorePriorityMetric.mutationOptions({
      mutationFn: (input) => client.restorePriorityMetric(input),
      onSuccess: (_, input) => invalidate(input),
    }),
    (input: PriorityMetricRevisionArgs) => ({
      ...input,
    }),
  );

  return { create, query, restore, trash, update };
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
      onSuccess: (_, input) => invalidate(input),
    }),
    (input: SetPriorityMetricValueArgs) => ({
      ...input,
      projectId,
    }),
  );

  const clearValue = usePreparedMutation(
    orpc.clearPriorityMetricValue.mutationOptions({
      mutationFn: (input) => client.clearPriorityMetricValue(input),
      onSuccess: (_, input) => invalidate(input),
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
