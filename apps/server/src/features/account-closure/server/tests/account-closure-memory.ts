import type {
  AccountClosureDrain,
  AccountClosureRecord,
  AccountClosureStore,
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
