import type {
  PlannedTestRelationTarget,
  PlannedTestRelationTargetType,
  PlannedTestStore,
  PlannedTestStoredCase,
  PlannedTestTargetResolver,
  SessionTestStoredRecord,
  TestHandoffStoredRecord,
} from "@cantiara/api/planned-tests";

import { createPlannedTests } from "./planned-tests";

export const accountId = "account-1";
export const projectId = "project-1";
export const archivedProjectId = "project-archived";

export type CatalogState = "active" | "archived" | "trashed" | "gone";

export interface CatalogEntry {
  /** Document only: the current revision and its stable sections. */
  documentRevision?: number;
  label: string;
  projectId: string;
  sections?: { id: string; label: string }[];
  state?: CatalogState;
  targetId: string;
  targetType: PlannedTestRelationTargetType;
}

/**
 * In-memory Planned Tests harness. The catalog stands in for the owner records
 * the live resolvers read; it holds no relation of its own, so a target that is
 * not in it behaves like a record that does not exist.
 */
export function createMemoryHarness(entries: CatalogEntry[] = []) {
  const catalog = new Map<string, CatalogEntry>();
  const key = (type: string, id: string) => `${type}:${id}`;
  for (const entry of entries) {
    catalog.set(key(entry.targetType, entry.targetId), { ...entry });
  }
  const cases = new Map<string, PlannedTestStoredCase>();
  const sessionTests = new Map<string, SessionTestStoredRecord>();
  const handoffs = new Map<string, TestHandoffStoredRecord>();

  function resolverFor(scopeProjectId: string): PlannedTestTargetResolver {
    function lookup(type: string, id: string) {
      const entry = catalog.get(key(type, id));
      return entry && entry.projectId === scopeProjectId ? entry : null;
    }
    return {
      bind: (relation) => {
        const entry = lookup(relation.targetType, relation.targetId);
        if (!entry || (entry.state ?? "active") !== "active") {
          return Promise.resolve(null);
        }
        if (relation.targetType !== "Document") {
          return Promise.resolve({ label: entry.label, sectionLabel: null });
        }
        if (relation.documentRevision !== entry.documentRevision) {
          return Promise.resolve(null);
        }
        if (relation.sectionId === undefined) {
          return Promise.resolve({ label: entry.label, sectionLabel: null });
        }
        const section = entry.sections?.find(
          ({ id }) => id === relation.sectionId,
        );
        return Promise.resolve(
          section ? { label: entry.label, sectionLabel: section.label } : null,
        );
      },
      candidates: (type) =>
        Promise.resolve(
          [...catalog.values()]
            .filter(
              (entry) =>
                entry.targetType === type &&
                entry.projectId === scopeProjectId &&
                (entry.state ?? "active") === "active",
            )
            .map(
              (entry): PlannedTestRelationTarget => ({
                documentRevision: entry.documentRevision ?? null,
                label: entry.label,
                sections: entry.sections ?? [],
                targetId: entry.targetId,
                targetType: entry.targetType,
              }),
            ),
        ),
      read: (relation) => {
        const entry = lookup(relation.targetType, relation.targetId);
        const state = entry?.state ?? "active";
        if (!entry || state === "gone") {
          return Promise.resolve({
            reason: "Permanently deleted" as const,
            state: "broken" as const,
          });
        }
        if (state === "trashed") {
          return Promise.resolve({
            reason: "In Trash" as const,
            state: "broken" as const,
          });
        }
        if (state === "archived") {
          return Promise.resolve({
            reason: "Archived" as const,
            state: "broken" as const,
          });
        }
        const section = entry.sections?.find(
          ({ id }) => id === relation.sectionId,
        );
        return Promise.resolve({
          label: entry.label,
          sectionLabel: section?.label ?? null,
          state: "resolved" as const,
        });
      },
    };
  }

  const store: PlannedTestStore = {
    run: async (account, scopeProjectId, _mode, work) => {
      const owned =
        account === accountId &&
        (scopeProjectId === projectId || scopeProjectId === archivedProjectId);
      if (!owned) {
        return null;
      }
      return await work({
        appendVersion: (caseId, version, updatedAt) => {
          const current = cases.get(caseId);
          if (!current) {
            throw new Error("Unknown case.");
          }
          cases.set(caseId, {
            ...current,
            currentVersion: version.version,
            updatedAt,
            versions: [...current.versions, version],
          });
          return Promise.resolve();
        },
        findCase: (caseId) => {
          const found = cases.get(caseId);
          return Promise.resolve(
            found && found.projectId === scopeProjectId ? found : null,
          );
        },
        findHandoff: (handoffId) => {
          const found = handoffs.get(handoffId);
          return Promise.resolve(
            found && found.projectId === scopeProjectId ? found : null,
          );
        },
        findSessionTest: (sessionTestId) => {
          const found = sessionTests.get(sessionTestId);
          return Promise.resolve(
            found && found.projectId === scopeProjectId ? found : null,
          );
        },
        insertCase: (record) => {
          cases.set(record.id, record);
          return Promise.resolve();
        },
        insertHandoff: (record) => {
          handoffs.set(record.id, record);
          return Promise.resolve();
        },
        insertSessionTest: (record) => {
          sessionTests.set(record.id, record);
          return Promise.resolve();
        },
        linkHandoffSessionTest: (handoffId, sessionTestId, linkedAt) => {
          const found = handoffs.get(handoffId);
          const taken = [...handoffs.values()].some((record) =>
            record.sessionTests.some(
              (item) => item.sessionTestId === sessionTestId,
            ),
          );
          if (!found || taken) {
            return Promise.resolve(false);
          }
          handoffs.set(handoffId, {
            ...found,
            sessionTests: [...found.sessionTests, { linkedAt, sessionTestId }],
          });
          return Promise.resolve(true);
        },
        linkSessionTest: (sessionTestId, ref, linkedAt) => {
          const found = sessionTests.get(sessionTestId);
          if (!found || found.scenarioId !== null) {
            return Promise.resolve(false);
          }
          sessionTests.set(sessionTestId, {
            ...found,
            bindOrigin: "Linked later",
            linkedAt,
            scenarioId: ref.caseId,
            scenarioVersion: ref.version,
          });
          return Promise.resolve(true);
        },
        listHandoffs: () =>
          Promise.resolve(
            [...handoffs.values()].filter(
              (record) => record.projectId === scopeProjectId,
            ),
          ),
        listSessionTests: () =>
          Promise.resolve(
            [...sessionTests.values()].filter(
              (record) => record.projectId === scopeProjectId,
            ),
          ),
        listCases: () =>
          Promise.resolve(
            [...cases.values()].filter(
              (record) => record.projectId === scopeProjectId,
            ),
          ),
        readOnly: scopeProjectId === archivedProjectId,
        replaceHandoffContent: (handoffId, content, updatedAt) => {
          const found = handoffs.get(handoffId);
          if (found) {
            handoffs.set(handoffId, { ...found, ...content, updatedAt });
          }
          return Promise.resolve();
        },
        resolver: resolverFor(scopeProjectId),
        setHandoffState: (handoffId, expected, to, changedAt) => {
          const found = handoffs.get(handoffId);
          if (!found || found.state !== expected) {
            return Promise.resolve(false);
          }
          handoffs.set(handoffId, {
            ...found,
            state: to,
            stateChangedAt: changedAt,
            updatedAt: changedAt,
          });
          return Promise.resolve(true);
        },
      });
    },
  };

  return {
    cases,
    catalog,
    handoffs,
    plannedTests: createPlannedTests(store),
    sessionTests,
    setState(type: string, id: string, state: CatalogState) {
      const entry = catalog.get(key(type, id));
      if (entry) {
        entry.state = state;
      }
    },
  };
}
