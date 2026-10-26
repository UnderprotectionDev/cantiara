import {
  deriveProjectActivity,
  type ProjectActivityAccess,
  type ProjectActivityFacts,
} from "@cantiara/api/project-activity";

/**
 * Project Activity behavior (spec 68). The feed is derived live on every read
 * from the attributed Kayıt geçmişi behind the read-only
 * `ProjectActivityStore`. This module has no write: it stores no event, mints
 * no Dikkat sinyali and no Story Timeline event, and keeps no run log.
 */

export class ProjectActivityProjectNotFoundError extends Error {
  readonly code = "PROJECT_ACTIVITY_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectActivityProjectNotFoundError";
  }
}

/**
 * Read port to the owners' history. It resolves to `null` when the account
 * does not own the Project. The store attributes each history entry to a
 * Project record through the owners' own tables; history it cannot attribute
 * is reported in `unattributed`, never guessed.
 */
export interface ProjectActivityStore {
  read: (
    accountId: string,
    projectId: string,
  ) => Promise<ProjectActivityFacts | null>;
}

export function createProjectActivity(
  store: ProjectActivityStore,
): ProjectActivityAccess {
  return {
    async list(accountId, input) {
      const facts = await store.read(accountId, input.projectId);
      if (!facts) {
        throw new ProjectActivityProjectNotFoundError(input.projectId);
      }
      return deriveProjectActivity(input.projectId, facts, input);
    },
  };
}
