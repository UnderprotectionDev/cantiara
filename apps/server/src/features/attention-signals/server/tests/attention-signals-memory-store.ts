import type { StoredAttentionSignal } from "@cantiara/api/attention-signals";

import type { AttentionSignalStore } from "../attention-signals";

/** In-memory harness: the same identity rule as the unique index. */
export function createMemoryAttentionSignalStore() {
  const rows = new Map<string, StoredAttentionSignal[]>();
  const store: AttentionSignalStore = {
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
  };
  return { rows, store };
}
