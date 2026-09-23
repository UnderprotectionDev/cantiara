import type { BacklogAccess, BacklogStore } from "@cantiara/api/backlog";

export function createBacklogAccess(store: BacklogStore): BacklogAccess {
  return {
    async list(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.list(workspaceId, projectId) : null;
    },
  };
}
