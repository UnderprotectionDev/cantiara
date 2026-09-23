import type {
  PriorityMetricStore,
  PriorityMetricsAccess,
} from "@cantiara/api/priority-metrics";

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
