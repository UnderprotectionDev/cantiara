import type {
  TestAssessmentContext,
  TestAssessmentContextCandidate,
  TestAssessmentContextEvent,
  TestAssessmentSourceKind,
  TestAssessmentStore,
  TestAssessmentStoredRecord,
} from "@cantiara/api/test-assessments";

import { createTestAssessments } from "../test-assessments";

export const accountId = "account-1";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";

export interface ContextEntry {
  id: string;
  kind: TestAssessmentContext["kind"];
  label: string;
  projectId: string;
}

/**
 * In-memory Test Assessments harness. `contexts` stands in for the Feature,
 * Handoff and Project Release owner records; `knownSources` lists the cited ids
 * an owner record vouches for. Ids of a kind with no entry stay opaque, like
 * Test Session and Test Gap ids before their owners exist.
 */
export function createMemoryHarness(
  contexts: ContextEntry[] = [],
  knownSources: Partial<Record<TestAssessmentSourceKind, string[]>> = {},
) {
  const catalog = [...contexts];
  const records: TestAssessmentStoredRecord[] = [];
  const events: (TestAssessmentContextEvent & {
    context: TestAssessmentContext;
  })[] = [];
  const store: TestAssessmentStore = {
    run: (account, scopeProjectId, mode, work) => {
      if (account !== accountId) {
        return Promise.resolve(null);
      }
      if (
        scopeProjectId !== projectId &&
        scopeProjectId !== archivedProjectId
      ) {
        return Promise.resolve(null);
      }
      const candidates = (kind: TestAssessmentContext["kind"]) =>
        catalog
          .filter(
            (entry) =>
              entry.projectId === scopeProjectId && entry.kind === kind,
          )
          .map(
            ({
              id,
              kind: entryKind,
              label,
            }): TestAssessmentContextCandidate => ({
              id,
              kind: entryKind,
              label,
            }),
          );
      return work({
        contextCandidates: (kind) => Promise.resolve(candidates(kind)),
        contextEvents: (context) =>
          Promise.resolve(
            events
              .filter(
                (event) =>
                  event.context.kind === context.kind &&
                  event.context.targetId === context.targetId,
              )
              .map(({ context: _context, ...event }) => event),
          ),
        contextLabel: (context) =>
          Promise.resolve(
            catalog.find(
              (entry) =>
                entry.projectId === scopeProjectId &&
                entry.kind === context.kind &&
                entry.id === context.targetId,
            )?.label ?? null,
          ),
        insert: (record) => {
          records.push(structuredClone(record));
          return Promise.resolve();
        },
        list: () =>
          Promise.resolve(
            records
              .filter((record) => record.projectId === scopeProjectId)
              .map((record) => structuredClone(record)),
          ),
        readOnly: mode === "write" && scopeProjectId === archivedProjectId,
        unknownSources: (kind, ids) => {
          const known = knownSources[kind];
          return Promise.resolve(
            known ? ids.filter((id) => !known.includes(id)) : [],
          );
        },
      });
    },
  };
  return {
    /** An owner reporting new recorded test context for a context. */
    addContextEvent: (
      context: TestAssessmentContext,
      event: TestAssessmentContextEvent,
    ) => {
      events.push({ ...event, context });
    },
    records,
    testAssessments: createTestAssessments(store),
  };
}
