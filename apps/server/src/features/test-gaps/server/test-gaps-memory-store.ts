import type {
  TestGapRelationTarget,
  TestGapRelationTargetType,
  TestGapStore,
  TestGapStoredRecord,
  TestGapTargetResolver,
} from "@cantiara/api/test-gaps";

import {
  accountId,
  archivedProjectId,
  createMemoryHarness as createPlannedTestsHarness,
  projectId,
} from "../../planned-tests/server/planned-tests-memory-store";
import { createTestGaps } from "./test-gaps";

export type CatalogState = "active" | "archived" | "trashed" | "gone";

export interface GapCatalogEntry {
  /** Document only: the current revision and its stable sections. */
  documentRevision?: number;
  label: string;
  projectId: string;
  sections?: { id: string; label: string }[];
  state?: CatalogState;
  targetId: string;
  targetType: TestGapRelationTargetType;
}

/**
 * In-memory Test Gaps harness. The catalog stands in for the owner records the
 * live resolvers read. The Planned Tests harness is shared so a test can stage
 * failed or reported Session Tests, cases and Handoffs next to the Gaps and
 * prove none of them ever files, plans or closes a Gap.
 */
export function createGapHarness(
  entries: GapCatalogEntry[] = [],
  planned = createPlannedTestsHarness(),
) {
  const catalog = new Map<string, GapCatalogEntry>();
  const key = (type: string, id: string) => `${type}:${id}`;
  for (const entry of entries) {
    catalog.set(key(entry.targetType, entry.targetId), { ...entry });
  }
  const gaps = new Map<string, TestGapStoredRecord>();

  function resolverFor(scopeProjectId: string): TestGapTargetResolver {
    const lookup = (type: string, id: string) => {
      const entry = catalog.get(key(type, id));
      return entry && entry.projectId === scopeProjectId ? entry : null;
    };
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
              (entry): TestGapRelationTarget => ({
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

  /** Handoff state is read live, as the PostgreSQL store joins it. */
  function withLiveBinds(record: TestGapStoredRecord): TestGapStoredRecord {
    return {
      ...record,
      handoffBinds: record.handoffBinds.map((bind) => ({
        ...bind,
        handoffState:
          planned.handoffs.get(bind.handoffId)?.state ?? bind.handoffState,
      })),
    };
  }

  const store: TestGapStore = {
    run: async (account, scopeProjectId, _mode, work) => {
      const owned =
        account === accountId &&
        (scopeProjectId === projectId || scopeProjectId === archivedProjectId);
      if (!owned) {
        return null;
      }
      const sameBind = (
        left: { caseId: string; version: number },
        right: { caseId: string; version: number },
      ) => left.caseId === right.caseId && left.version === right.version;
      const patch = (gapId: string, change: Partial<TestGapStoredRecord>) => {
        const found = gaps.get(gapId);
        if (found) {
          gaps.set(gapId, { ...found, ...change });
        }
      };
      return await work({
        addCaseBind: (gapId, ref) => {
          const found = gaps.get(gapId);
          const scenario = planned.cases.get(ref.caseId);
          const version = scenario?.versions.find(
            (item) => item.version === ref.version,
          );
          if (
            !(found && version) ||
            found.caseBinds.some((bind) => sameBind(bind, ref))
          ) {
            return Promise.resolve(false);
          }
          patch(gapId, {
            caseBinds: [
              ...found.caseBinds,
              {
                caseId: ref.caseId,
                title: version.title,
                version: ref.version,
              },
            ],
          });
          return Promise.resolve(true);
        },
        addHandoffBind: (gapId, handoffId) => {
          const found = gaps.get(gapId);
          const handoff = planned.handoffs.get(handoffId);
          if (
            !(found && handoff) ||
            found.handoffBinds.some((bind) => bind.handoffId === handoffId)
          ) {
            return Promise.resolve(false);
          }
          patch(gapId, {
            handoffBinds: [
              ...found.handoffBinds,
              { handoffId, handoffState: handoff.state, title: handoff.title },
            ],
          });
          return Promise.resolve(true);
        },
        findCaseVersion: (ref) => {
          const found = planned.cases.get(ref.caseId);
          const version = found?.versions.find(
            (item) => item.version === ref.version,
          );
          return Promise.resolve(
            found?.projectId === scopeProjectId && version
              ? { title: version.title }
              : null,
          );
        },
        findGap: (gapId) => {
          const found = gaps.get(gapId);
          return Promise.resolve(
            found && found.projectId === scopeProjectId
              ? withLiveBinds(found)
              : null,
          );
        },
        findHandoff: (handoffId) => {
          const found = planned.handoffs.get(handoffId);
          return Promise.resolve(
            found && found.projectId === scopeProjectId
              ? { handoffState: found.state, title: found.title }
              : null,
          );
        },
        insertGap: (record) => {
          gaps.set(record.id, record);
          return Promise.resolve();
        },
        listGaps: () =>
          Promise.resolve(
            [...gaps.values()]
              .filter((record) => record.projectId === scopeProjectId)
              .map(withLiveBinds),
          ),
        readOnly: scopeProjectId === archivedProjectId,
        removeCaseBind: (gapId, ref) => {
          const found = gaps.get(gapId);
          if (!found?.caseBinds.some((bind) => sameBind(bind, ref))) {
            return Promise.resolve(false);
          }
          patch(gapId, {
            caseBinds: found.caseBinds.filter((bind) => !sameBind(bind, ref)),
          });
          return Promise.resolve(true);
        },
        removeHandoffBind: (gapId, handoffId) => {
          const found = gaps.get(gapId);
          if (
            !found?.handoffBinds.some((bind) => bind.handoffId === handoffId)
          ) {
            return Promise.resolve(false);
          }
          patch(gapId, {
            handoffBinds: found.handoffBinds.filter(
              (bind) => bind.handoffId !== handoffId,
            ),
          });
          return Promise.resolve(true);
        },
        resolver: resolverFor(scopeProjectId),
        setGapState: (gapId, expected, to, changedAt) => {
          const found = gaps.get(gapId);
          if (!found || found.state !== expected) {
            return Promise.resolve(false);
          }
          patch(gapId, {
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
    catalog,
    gaps,
    planned,
    setState(type: string, id: string, state: CatalogState) {
      const entry = catalog.get(key(type, id));
      if (entry) {
        entry.state = state;
      }
    },
    testGaps: createTestGaps(store),
  };
}
