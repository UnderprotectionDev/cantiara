import type {
  TestResultStoredEvent,
  TestReviewStore,
  TestReviewStoredEvent,
  TestReviewStoredSession,
} from "@cantiara/api/test-review";

import { createTestReview } from "./test-review";

export const accountId = "account-1";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";

/** What the harness lets the tests observe about every write the seam made. */
export type WriteKind =
  | "event"
  | "item-state"
  | "result-event"
  | "result-erase"
  | "session-state";

/**
 * In-memory Test Review harness. Test Sessions and Session Tests are seeded as
 * if Test Report Acceptance (spec 54) already accepted them. The harness
 * records every write kind in `writes`, so a test can prove a review wrote no
 * result, Handoff, Project Release or Test Gap (the transaction has no such
 * member). A unit of work that throws is rolled back, and
 * `faults.failAfterItemWrite` fails a step AFTER the item states were written.
 */
export function createMemoryHarness(sessions: TestReviewStoredSession[] = []) {
  let state = new Map(
    sessions.map((session) => [session.id, structuredClone(session)]),
  );
  let events: TestReviewStoredEvent[] = [];
  let resultEvents: TestResultStoredEvent[] = [];
  const writes: WriteKind[] = [];
  const faults = { failAfterItemWrite: false as boolean };

  const store: TestReviewStore = {
    run: async (account, scopeProjectId, _mode, work) => {
      if (
        account !== accountId ||
        (scopeProjectId !== projectId && scopeProjectId !== archivedProjectId)
      ) {
        return null;
      }
      const snapshot = {
        events: [...events],
        resultEvents: structuredClone(resultEvents),
        sessions: structuredClone(state),
        writes: writes.length,
      };
      try {
        return await work({
          appendEvents: (appended) => {
            writes.push("event");
            events.push(...structuredClone(appended));
            return Promise.resolve();
          },
          appendResultEvents: (appended) => {
            writes.push("result-event");
            resultEvents.push(...structuredClone(appended));
            return Promise.resolve();
          },
          eraseResultEventContent: (eventId) => {
            writes.push("result-erase");
            resultEvents = resultEvents.map((entry) =>
              entry.id === eventId
                ? { ...entry, correctedResult: null, note: null, reason: null }
                : entry,
            );
            return Promise.resolve();
          },
          findSession: (sessionId) => {
            const found = state.get(sessionId);
            return Promise.resolve(
              found && found.projectId === scopeProjectId
                ? structuredClone(found)
                : null,
            );
          },
          listEvents: () =>
            Promise.resolve(
              events.filter((event) =>
                [...state.values()].some(
                  (session) =>
                    session.id === event.sessionId &&
                    session.projectId === scopeProjectId,
                ),
              ),
            ),
          listResultEvents: () =>
            Promise.resolve(
              structuredClone(
                resultEvents.filter((event) =>
                  [...state.values()].some(
                    (session) =>
                      session.id === event.sessionId &&
                      session.projectId === scopeProjectId,
                  ),
                ),
              ),
            ),
          listSessions: () =>
            Promise.resolve(
              [...state.values()]
                .filter((session) => session.projectId === scopeProjectId)
                .map((session) => structuredClone(session)),
            ),
          readOnly: scopeProjectId === archivedProjectId,
          writeItemStates: (ids, next) => {
            writes.push("item-state");
            for (const session of state.values()) {
              for (const item of session.items) {
                if (ids.includes(item.id)) {
                  item.reviewState = next;
                }
              }
            }
            if (faults.failAfterItemWrite) {
              return Promise.reject(new Error("Store failed after the items."));
            }
            return Promise.resolve();
          },
          writeSessionState: (id, next) => {
            writes.push("session-state");
            const found = state.get(id);
            if (found) {
              found.reviewState = next;
            }
            return Promise.resolve();
          },
        });
      } catch (error) {
        state = snapshot.sessions;
        ({ events, resultEvents } = snapshot);
        writes.length = snapshot.writes;
        throw error;
      }
    },
  };

  return {
    faults,
    get events() {
      return events;
    },
    get resultEvents() {
      return resultEvents;
    },
    get sessions() {
      return state;
    },
    testReview: createTestReview(store),
    writes,
  };
}

/** A reported session as acceptance leaves it: Unreviewed, items Unreviewed. */
export function fixtureSession(
  id: string,
  items: { id: string; normalized?: string; raw?: string; title: string }[],
  overrides: Partial<TestReviewStoredSession> = {},
): TestReviewStoredSession {
  return {
    executorName: "Codex",
    id,
    items: items.map((item, position) => ({
      id: item.id,
      normalizedResult: item.normalized ?? "Passed",
      position,
      rawResult: item.raw ?? "pass",
      reviewState: "Unreviewed",
      title: item.title,
    })),
    projectId,
    reportedAt: "2026-10-01T09:00:00.000Z",
    reviewState: "Unreviewed",
    summary: null,
    ...overrides,
  };
}
