import type { ProjectActivityFacts } from "@cantiara/api/project-activity";

import type { ProjectActivityStore } from "./project-activity";

/**
 * In-memory harness for the Project Activity seam: one account's Projects and a
 * fixture of attributed history per Project. Tests drive the real behavior
 * through it without a database.
 */
export function createMemoryProjectActivity(options: {
  accountId: string;
  facts: Map<string, ProjectActivityFacts>;
}): ProjectActivityStore {
  return {
    read(accountId, projectId) {
      const facts = options.facts.get(projectId);
      return Promise.resolve(
        accountId === options.accountId && facts ? facts : null,
      );
    },
  };
}
