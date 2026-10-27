import type {
  ClosureSummaryCandidate,
  ClosureSummaryDateFacts,
} from "@cantiara/api/project-closure-summary";

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
    {
      candidates: ClosureSummaryCandidate[];
      dateFacts?: ClosureSummaryDateFacts[];
      status: string;
    }
  >;
  timeZone?: string;
}): ProjectClosureSummarySources {
  return {
    dateFacts: (accountId, projectId, records) =>
      Promise.resolve({
        facts:
          accountId === options.accountId
            ? (options.projects.get(projectId)?.dateFacts ?? []).filter(
                (fact) =>
                  records.some(
                    (record) =>
                      record.recordId === fact.recordId &&
                      record.recordType === fact.recordType,
                  ),
              )
            : [],
        timeZone: options.timeZone ?? "UTC",
      }),
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
