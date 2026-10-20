import type {
  PlannedTestRelationTarget,
  PlannedTestRelationTargetType,
  PlannedTestStore,
  PlannedTestStoredCase,
  PlannedTestTargetResolver,
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
        insertCase: (record) => {
          cases.set(record.id, record);
          return Promise.resolve();
        },
        listCases: () =>
          Promise.resolve(
            [...cases.values()].filter(
              (record) => record.projectId === scopeProjectId,
            ),
          ),
        readOnly: scopeProjectId === archivedProjectId,
        resolver: resolverFor(scopeProjectId),
      });
    },
  };

  return {
    cases,
    catalog,
    plannedTests: createPlannedTests(store),
    setState(type: string, id: string, state: CatalogState) {
      const entry = catalog.get(key(type, id));
      if (entry) {
        entry.state = state;
      }
    },
  };
}
