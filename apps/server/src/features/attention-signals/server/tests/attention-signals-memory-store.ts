import type { StoredAttentionSignal } from "@cantiara/api/attention-signals";

import type {
  AttentionSignalStore,
  AttentionSourceResolver,
} from "../attention-signals";

/** In-memory harness: the same identity rule as the unique index. */
export function createMemoryAttentionSignalStore() {
  const rows = new Map<string, StoredAttentionSignal[]>();
  /** Follow-up receipts and the İşler they created, by attempt id. */
  const followUps = new Map<
    string,
    { signalRowId: string; title: string; workId: string }
  >();
  const store: AttentionSignalStore = {
    commitFollowUp(_accountId, commit) {
      const prior = followUps.get(commit.attemptId);
      if (prior) {
        return Promise.resolve(
          prior.signalRowId === commit.signal.id
            ? { outcome: "duplicate", workId: prior.workId }
            : { outcome: "attemptConflict" },
        );
      }
      if (!commit.signal.projectId) {
        return Promise.resolve({ outcome: "projectUnavailable" });
      }
      followUps.set(commit.attemptId, {
        signalRowId: commit.signal.id,
        title: commit.plan.title,
        workId: commit.workId,
      });
      return Promise.resolve({ outcome: "created", workId: commit.workId });
    },
    find: (accountId, signalRowId) =>
      Promise.resolve(
        (rows.get(accountId) ?? []).find((row) => row.id === signalRowId) ??
          null,
      ),
    insertIfAbsent(accountId, signal) {
      const own = rows.get(accountId) ?? [];
      const existing = own.find(
        (row) =>
          row.signalId === signal.signalId &&
          row.eventId === signal.eventId &&
          row.targetId === signal.targetId,
      );
      if (existing) {
        return Promise.resolve({ created: false, signal: existing });
      }
      rows.set(accountId, [...own, signal]);
      return Promise.resolve({ created: true, signal });
    },
    list: (accountId) => Promise.resolve([...(rows.get(accountId) ?? [])]),
    setMarks(accountId, signalRowId, marks) {
      const own = rows.get(accountId) ?? [];
      const index = own.findIndex((row) => row.id === signalRowId);
      const current = own[index];
      if (!current) {
        return Promise.resolve(null);
      }
      const next = { ...current, ...marks };
      own[index] = next;
      return Promise.resolve(next);
    },
  };
  return { followUps, rows, store };
}

/**
 * A producer double that owns a mutable source: records can be deleted and
 * events can vanish. `writes` counts every write the center made to it, which
 * must stay zero.
 */
export function createSourceDouble() {
  const state = {
    deletedRecords: new Set<string>(),
    resolvableEvents: new Set<string>(),
    writes: 0,
  };
  const resolver: AttentionSourceResolver = {
    event: (_accountId, signal) =>
      Promise.resolve(
        state.resolvableEvents.has(signal.eventId) ? "resolved" : "unresolved",
      ),
    record: (_accountId, group) =>
      Promise.resolve(
        state.deletedRecords.has(`${group.kind}:${group.id}`)
          ? "deleted"
          : "present",
      ),
  };
  return { resolver, state };
}
