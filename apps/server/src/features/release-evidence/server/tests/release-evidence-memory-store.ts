import type {
  ReleaseEvidenceChecklistItem,
  ReleaseEvidencePack,
} from "@cantiara/api/release-evidence";

import type {
  ReleaseEvidenceSourceFacts,
  ReleaseEvidenceSources,
  ReleaseEvidenceStore,
} from "../release-evidence";

/**
 * In-memory harness for the Release Evidence Pack seam. It holds one account's
 * Projects and releases, the checklist lines and the signal close marks, and a
 * fixture of owner-record facts per release. Tests drive the real behavior
 * through it without a database.
 */
export function createMemoryReleaseEvidence(options: {
  accountId: string;
  archivedProjectIds?: string[];
  projectIds: string[];
  releases: (ReleaseEvidencePack["release"] & { projectId: string })[];
  sources: Map<string, ReleaseEvidenceSourceFacts>;
}) {
  const checklist = new Map<string, ReleaseEvidenceChecklistItem[]>();
  const closed = new Set<string>();
  let counter = 0;

  const store: ReleaseEvidenceStore = {
    run(accountId, projectId, releaseId, _mode, work) {
      const archived = options.archivedProjectIds?.includes(projectId);
      if (
        accountId !== options.accountId ||
        !options.projectIds.includes(projectId)
      ) {
        return Promise.resolve(null);
      }
      return work({
        addChecklistItem: (text) => {
          counter += 1;
          const item = { checked: false, id: `item-${counter}`, text };
          checklist.set(releaseId, [...(checklist.get(releaseId) ?? []), item]);
          return Promise.resolve(item);
        },
        checklist: () => Promise.resolve([...(checklist.get(releaseId) ?? [])]),
        closeSignal: (signalId) => {
          closed.add(`${releaseId}:${signalId}`);
          return Promise.resolve();
        },
        readOnly: Boolean(archived),
        release: () =>
          Promise.resolve(
            options.releases.find(
              (release) =>
                release.id === releaseId && release.projectId === projectId,
            ) ?? null,
          ),
        removeChecklistItem: (itemId) => {
          const items = checklist.get(releaseId) ?? [];
          checklist.set(
            releaseId,
            items.filter((item) => item.id !== itemId),
          );
          return Promise.resolve(items.some((item) => item.id === itemId));
        },
        setChecklistItem: (itemId, checked) => {
          const items = checklist.get(releaseId) ?? [];
          const index = items.findIndex((item) => item.id === itemId);
          if (index < 0) {
            return Promise.resolve(null);
          }
          const next = {
            ...items[index],
            checked,
          } as ReleaseEvidenceChecklistItem;
          checklist.set(
            releaseId,
            items.map((item, at) => (at === index ? next : item)),
          );
          return Promise.resolve(next);
        },
        signalClosed: (signalId) =>
          Promise.resolve(closed.has(`${releaseId}:${signalId}`)),
      });
    },
  };

  const sources: ReleaseEvidenceSources = {
    read: (_accountId, _projectId, releaseId) => {
      const facts = options.sources.get(releaseId);
      if (!facts) {
        throw new Error(`No fixture facts for release ${releaseId}.`);
      }
      return Promise.resolve(facts);
    },
  };

  return { sources, store };
}
