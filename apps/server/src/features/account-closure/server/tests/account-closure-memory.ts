import type {
  AccountClosureDrain,
  AccountClosureExitPackage,
  AccountClosureRecord,
  AccountClosureStore,
  AccountDeleteTombstone,
} from "@cantiara/api/account-closure";

export function createMemoryClosureStore(): AccountClosureStore & {
  records: Map<string, AccountClosureRecord>;
} {
  const records = new Map<string, AccountClosureRecord>();
  return {
    get: (accountId) => Promise.resolve(records.get(accountId) ?? null),
    records,
    transition: (accountId, from, next) => {
      const state = records.get(accountId)?.state ?? "living";
      if (state !== from) {
        return Promise.resolve(false);
      }
      records.set(accountId, next);
      return Promise.resolve(true);
    },
  };
}

export function createDrainDouble(
  overrides: Partial<AccountClosureDrain> = {},
) {
  const calls: string[] = [];
  const drain: AccountClosureDrain = {
    cancelPreBarrierWork: () => {
      calls.push("cancel-pre-barrier");
      return Promise.resolve([
        { id: "import-1", kind: "import", status: "cancelled" },
      ]);
    },
    failClose: () => {
      calls.push("fail-close");
      return Promise.resolve({
        endedSessions: 2,
        externalAccessClosed: true,
        extensionConnectionsRevoked: 1,
        githubLoginAndAppRevoked: true,
        integrationsClosed: true,
      });
    },
    settleIrreversibleWork: () => {
      calls.push("settle-irreversible");
      return Promise.resolve([
        { id: "redaction-1", kind: "redaction", outcome: "committed" },
      ]);
    },
    ...overrides,
  };
  return { calls, drain };
}

/** 82 double: records the window it was asked for and the success flag. */
export function createExitPackageDouble() {
  const produced: { accountId: string; downloadWindowMs?: number }[] = [];
  const exitPackage: AccountClosureExitPackage = {
    download: (token) =>
      token === "token-1"
        ? Promise.resolve(new Uint8Array([1, 2, 3]))
        : Promise.reject(new Error("unknown token")),
    produce: ({ accountId, downloadWindowMs }) => {
      produced.push({ accountId, downloadWindowMs });
      return Promise.resolve({
        download: {
          expiresAt: "2026-03-31T00:00:00.000Z",
          packageId: "package-1",
          token: "token-1",
        },
        packageId: "package-1",
      });
    },
    successfulProduction: () =>
      Promise.resolve(
        produced.length > 0
          ? { packageId: "package-1", producedAt: "2026-03-02T00:00:00.000Z" }
          : null,
      ),
  };
  return Object.assign(exitPackage, { produced });
}

export const CLOSURE_ACTOR = {
  accountId: "account-1",
  accountName: "Mert Demirkaya",
};

/**
 * Account Access grant double: one grant per operation id, usable once, so a
 * start grant can never cancel and a replay is refused.
 */
export function createGrantDouble(grants: Record<string, string>) {
  const unused = new Map(Object.entries(grants));
  const consumed: string[] = [];
  const consume = (operationId: string, grant: string) => {
    consumed.push(operationId);
    if (unused.get(operationId) === grant) {
      unused.delete(operationId);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  };
  return { consume, consumed };
}

/**
 * Doubles for the terminal removal: the 78 removal, the 85 tombstone log and
 * the 01 identity directory (stable GitHub user id -> Account id).
 */
export function createDeletionDoubles() {
  const calls: string[] = [];
  const tombstones: AccountDeleteTombstone[] = [];
  const directory = new Map<string, string>();
  let counter = 0;
  const signIn = (githubUserId: string) => {
    const existing = directory.get(githubUserId);
    if (existing) {
      return existing;
    }
    counter += 1;
    const accountId = `account-new-${counter}`;
    directory.set(githubUserId, accountId);
    return accountId;
  };
  return {
    calls,
    directory,
    identity: {
      release: (accountId: string) => {
        calls.push("release-identity");
        for (const [githubUserId, owner] of directory) {
          if (owner === accountId) {
            directory.delete(githubUserId);
          }
        }
        return Promise.resolve();
      },
    },
    removal: {
      removeAccountAndWorkspace: (accountId: string) => {
        calls.push(`remove:${accountId}`);
        return Promise.resolve();
      },
    },
    signIn,
    tombstoneLog: {
      alias: () => Promise.resolve("alias-7f3a"),
      /** Upsert by id: the irreversible log keeps one entry per Account. */
      append: (tombstone: AccountDeleteTombstone) => {
        calls.push("tombstone");
        const existing = tombstones.findIndex(
          (entry) => entry.id === tombstone.id,
        );
        if (existing >= 0) {
          tombstones[existing] = tombstone;
        } else {
          tombstones.push(tombstone);
        }
        return Promise.resolve();
      },
    },
    tombstones,
  };
}
