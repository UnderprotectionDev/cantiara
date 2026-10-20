import type {
  TestReportStore,
  TestSessionStoredRecord,
} from "@cantiara/api/test-report";

import { createTestReportAcceptance } from "./test-report";

export const accountId = "account-1";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";

/**
 * In-memory Test Report Acceptance harness. `scenarios` stands in for the
 * Planned Test Case versions that exist as `caseId@version`; a Test Session is
 * only ever inserted after every check passed, so a refusal leaves `sessions`
 * (and everything else here) untouched.
 */
export function createMemoryHarness(scenarios: string[] = []) {
  const sessions = new Map<string, TestSessionStoredRecord>();
  const knownScenarios = new Set(scenarios);

  const store: TestReportStore = {
    run: async (account, scopeProjectId, _mode, work) => {
      const owned =
        account === accountId &&
        (scopeProjectId === projectId || scopeProjectId === archivedProjectId);
      if (!owned) {
        return null;
      }
      return await work({
        insertSession: (record) => {
          sessions.set(record.id, record);
          return Promise.resolve();
        },
        listSessions: () =>
          Promise.resolve(
            [...sessions.values()].filter(
              (record) => record.projectId === scopeProjectId,
            ),
          ),
        readOnly: scopeProjectId === archivedProjectId,
        scenarioVersionExists: (caseId, version) =>
          Promise.resolve(knownScenarios.has(`${caseId}@${version}`)),
      });
    },
  };

  return {
    sessions,
    testReports: createTestReportAcceptance(store),
  };
}
