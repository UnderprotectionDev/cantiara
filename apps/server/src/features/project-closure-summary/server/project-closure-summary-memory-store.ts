import type { ClosureSummaryCandidate } from "@cantiara/api/project-closure-summary";

import type { ProjectClosureSummarySources } from "./project-closure-summary";

/**
 * In-memory harness for the Project Closure Summary seam: one account's
 * Projects with their lifecycle status and live candidate records. Tests drive
 * the real behavior through it without a database.
 */
export function createMemoryProjectClosureSummary(options: {
  accountId: string;
  projects: Map<
    string,
    { candidates: ClosureSummaryCandidate[]; status: string }
  >;
}): ProjectClosureSummarySources {
  return {
    candidates: (accountId, projectId) =>
      Promise.resolve(
        accountId === options.accountId
          ? [...(options.projects.get(projectId)?.candidates ?? [])]
          : [],
      ),
    projectStatus: (accountId, projectId) =>
      Promise.resolve(
        accountId === options.accountId
          ? (options.projects.get(projectId)?.status ?? null)
          : null,
      ),
  };
}
