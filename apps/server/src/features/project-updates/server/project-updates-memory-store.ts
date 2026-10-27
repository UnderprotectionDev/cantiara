import type { ProjectUpdateLinkInput } from "@cantiara/api/project-updates";

import {
  type ProjectUpdateLinkFact,
  type ProjectUpdatesStore,
  projectUpdateLinkKey,
  type StoredProjectUpdate,
} from "./project-updates";

/**
 * In-memory harness for the Manual Project Updates seam: one account's
 * Projects and their live owner records, plus the append-only entry list.
 */
export function createMemoryProjectUpdates(options: {
  accountId: string;
  projects: Map<
    string,
    { archived?: boolean; records: Map<string, ProjectUpdateLinkFact> }
  >;
}) {
  const entries: StoredProjectUpdate[] = [];
  const store: ProjectUpdatesStore = {
    find: (projectId, updateId) =>
      Promise.resolve(
        entries.find(
          (entry) => entry.projectId === projectId && entry.id === updateId,
        ) ?? null,
      ),
    insert: (update) => {
      if (entries.some((entry) => entry.id === update.id)) {
        return Promise.resolve(false);
      }
      entries.push(structuredClone(update));
      return Promise.resolve(true);
    },
    linkFacts: (projectId, links: readonly ProjectUpdateLinkInput[]) => {
      const records = options.projects.get(projectId)?.records;
      const facts = new Map<string, ProjectUpdateLinkFact>();
      for (const link of links) {
        const fact = records?.get(projectUpdateLinkKey(link));
        if (fact) {
          facts.set(projectUpdateLinkKey(link), fact);
        }
      }
      return Promise.resolve(facts);
    },
    list: (projectId) =>
      Promise.resolve(
        entries
          .filter((entry) => entry.projectId === projectId)
          .map((entry) => structuredClone(entry)),
      ),
    project: (accountId, projectId) => {
      const project = options.projects.get(projectId);
      return Promise.resolve(
        accountId === options.accountId && project
          ? { archived: Boolean(project.archived) }
          : null,
      );
    },
  };
  return { entries, store };
}
