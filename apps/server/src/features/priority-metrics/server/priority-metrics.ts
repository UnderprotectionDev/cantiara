import type {
  PriorityMetricStore,
  PriorityMetricsAccess,
} from "@cantiara/api/priority-metrics";

export class PriorityMetricNameConflictError extends Error {
  readonly code = "PRIORITY_METRIC_NAME_CONFLICT" as const;

  constructor(name: string) {
    super(`A Priority metric named ${name} already exists in this Project.`);
    this.name = "PriorityMetricNameConflictError";
  }
}

export function createPriorityMetricsAccess(
  store: PriorityMetricStore,
): PriorityMetricsAccess {
  return {
    async list(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.list(workspaceId, projectId) : null;
    },
    async projectValues(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.projectValues(workspaceId, projectId) : null;
    },
    async trashImpactPreview(accountId, metricId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId
        ? store.trashImpactPreview(workspaceId, metricId)
        : null;
    },
    async values(accountId, workId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.values(workspaceId, workId) : null;
    },
  };
}
