import type { BacklogAccess, BacklogStore } from "@cantiara/api/backlog";

export function createBacklogAccess(store: BacklogStore): BacklogAccess {
  return {
    async list(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.list(workspaceId, projectId) : null;
    },
    async listPrepared(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.listPrepared(workspaceId, projectId) : null;
    },
    async listPresentation(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId
        ? store.listPresentation(workspaceId, projectId)
        : null;
    },
  };
}
