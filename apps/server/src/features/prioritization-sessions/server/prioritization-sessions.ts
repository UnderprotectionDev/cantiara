import type {
  PrioritizationSessionStore,
  PrioritizationSessionsAccess,
} from "@cantiara/api/prioritization-sessions";

export function createPrioritizationSessionsAccess(
  store: PrioritizationSessionStore,
): PrioritizationSessionsAccess {
  return {
    async list(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      return workspaceId ? store.list(workspaceId, projectId) : null;
    },
  };
}
