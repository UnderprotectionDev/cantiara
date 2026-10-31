import type { ExitPackageSuccess } from "@cantiara/api/workspace-exit-package";

import type {
  ExitPackageStore,
  StoredExitPackage,
} from "./workspace-exit-package";

/** In-process store: spec 82 ships the seam, the durable adapter comes with the product surface. */
export function createMemoryExitPackageStore() {
  const active = new Map<string, StoredExitPackage>();
  const successes = new Map<string, ExitPackageSuccess>();
  const store: ExitPackageStore = {
    findByTokenDigest(digest) {
      for (const record of active.values()) {
        if (record.tokenDigest === digest) {
          return Promise.resolve(record);
        }
      }
      return Promise.resolve(null);
    },
    lastSuccess: (accountId) =>
      Promise.resolve(successes.get(accountId) ?? null),
    recordSuccess(accountId, success) {
      successes.set(accountId, success);
      return Promise.resolve();
    },
    replaceActive(record) {
      active.set(record.accountId, record);
      return Promise.resolve();
    },
    revoke(accountId, packageId, at) {
      const record = active.get(accountId);
      if (!record || record.packageId !== packageId) {
        return Promise.resolve(false);
      }
      active.set(accountId, { ...record, revokedAt: at });
      return Promise.resolve(true);
    },
  };
  return {
    activeCount: () => active.size,
    /** Everything the store holds, for tests that scan for leaked passwords. */
    snapshot: () => ({
      active: [...active.values()],
      successes: [...successes.values()],
    }),
    store,
  };
}
