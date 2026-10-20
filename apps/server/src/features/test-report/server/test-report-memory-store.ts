import type {
  TestReportHandoffRef,
  TestReportStore,
  TestSessionStoredRecord,
} from "@cantiara/api/test-report";

import { createTestReportAcceptance } from "./test-report";

export const accountId = "account-1";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";
export const otherProjectId = "project-other";

export interface HandoffEntry extends TestReportHandoffRef {
  projectId: string;
}

export interface ReferenceEntry {
  id: string;
  projectId: string;
  type: string;
}

export interface MemoryHarnessOptions {
  /** Handoffs that exist, with the package they last produced. */
  handoffs?: HandoffEntry[];
  /** Allow-listed records that exist (`work`, `feature`, `project_release`, ...). */
  references?: ReferenceEntry[];
  /** `caseId@version` of the Planned Test Case versions that exist in `projectId`. */
  scenarios?: string[];
}

/**
 * In-memory Test Report Acceptance harness. A unit of work that throws is
 * rolled back like a database transaction (`sessions` and `identities` are
 * restored), and `failAfterSessionInsert` makes the store fail a step AFTER the
 * Test Session was written, so the tests can prove no residue is left. The
 * default `failAfterSessionInsert` is off.
 */
export function createMemoryHarness(options: MemoryHarnessOptions = {}) {
  let sessions = new Map<string, TestSessionStoredRecord>();
  let identities = new Map<string, string>();
  const knownScenarios = new Set(options.scenarios ?? []);
  const handoffs = options.handoffs ?? [];
  const references = options.references ?? [];
  const faults = { failAfterSessionInsert: false as boolean };

  const store: TestReportStore = {
    run: async (account, scopeProjectId, _mode, work) => {
      const owned =
        account === accountId &&
        (scopeProjectId === projectId || scopeProjectId === archivedProjectId);
      if (!owned) {
        return null;
      }
      const snapshot = {
        identities: new Map(identities),
        sessions: new Map(sessions),
      };
      try {
        return await work({
          findHandoff: (handoffId) => {
            const found = handoffs.find(({ id }) => id === handoffId);
            if (!found) {
              return Promise.resolve(null);
            }
            return Promise.resolve(
              found.projectId === scopeProjectId ? found : "other_project",
            );
          },
          findSessionByIdentity: (ingress, reporterId, externalSessionId) => {
            const id = identities.get(
              [scopeProjectId, ingress, reporterId, externalSessionId].join(
                "|",
              ),
            );
            return Promise.resolve(id ? (sessions.get(id) ?? null) : null);
          },
          insertSession: (record) => {
            const key = [
              scopeProjectId,
              record.ingress,
              record.reporter.id,
              record.externalSessionId,
            ].join("|");
            if (identities.has(key)) {
              return Promise.resolve(false);
            }
            identities.set(key, record.id);
            sessions.set(record.id, record);
            if (faults.failAfterSessionInsert) {
              return Promise.reject(
                new Error("Store failed after the session."),
              );
            }
            return Promise.resolve(true);
          },
          listSessions: () =>
            Promise.resolve(
              [...sessions.values()].filter(
                (record) => record.projectId === scopeProjectId,
              ),
            ),
          readOnly: scopeProjectId === archivedProjectId,
          resolveReference: (type, id, version) => {
            if (type === "planned_test_case") {
              return Promise.resolve(
                knownScenarios.has(`${id}@${version}`) ? "found" : "missing",
              );
            }
            const found = references.find(
              (entry) => entry.type === type && entry.id === id,
            );
            if (!found) {
              return Promise.resolve("missing");
            }
            return Promise.resolve(
              found.projectId === scopeProjectId ? "found" : "other_project",
            );
          },
        });
      } catch (error) {
        ({ identities, sessions } = snapshot);
        throw error;
      }
    },
  };

  return {
    faults,
    get identities() {
      return identities;
    },
    get sessions() {
      return sessions;
    },
    testReports: createTestReportAcceptance(store),
  };
}
