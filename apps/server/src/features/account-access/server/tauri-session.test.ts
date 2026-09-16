import { describe, expect, test } from "vitest";

import {
  createTauriSessionAccess,
  TAURI_AUTH_CODE_IDENTIFIER_PREFIX,
  type TauriAuthCodeConsumptionStore,
  type TauriAuthCodeStore,
} from "./tauri-session";

const NOW = new Date("2026-09-16T09:00:00.000Z");
const CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const WRONG_CODE_VERIFIER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

function createCodeStore() {
  const records = new Map<
    string,
    { codeChallenge: string; expiresAt: Date; sessionId: string }
  >();
  const store: TauriAuthCodeStore = {
    find(identifier, now) {
      const record = records.get(identifier);
      if (!record || record.expiresAt <= now) {
        return Promise.resolve(null);
      }
      return Promise.resolve(record);
    },
    consume(identifier, now) {
      const record = records.get(identifier);
      if (!record || record.expiresAt <= now) {
        return Promise.resolve(null);
      }
      records.delete(identifier);
      return Promise.resolve(record);
    },
    create(identifier, record, expiresAt) {
      records.set(identifier, { ...record, expiresAt });
      return Promise.resolve();
    },
  };
  return { records, store };
}

function createConsumedCodeStore() {
  const identifiers = new Set<string>();
  const store: TauriAuthCodeConsumptionStore = {
    record(identifier) {
      if (identifiers.has(identifier)) {
        return Promise.resolve(false);
      }
      identifiers.add(identifier);
      return Promise.resolve(true);
    },
  };
  return { identifiers, store };
}

describe("Account Access Tauri bearer exchange", () => {
  test("exchanges a short-lived code once and keeps the raw code out of storage", async () => {
    const { records, store } = createCodeStore();
    const { store: consumedCodes } = createConsumedCodeStore();
    const access = createTauriSessionAccess({
      codeStore: store,
      consumedCodes,
      now: () => NOW,
      randomCode: () => "one-time-code",
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    const code = await access.issueCode("session-1", CODE_CHALLENGE);

    expect(code).toBe("one-time-code");
    const [storedIdentifier] = [...records.keys()];
    expect(storedIdentifier).toMatch(
      new RegExp(`^${TAURI_AUTH_CODE_IDENTIFIER_PREFIX}`),
    );
    expect(storedIdentifier).not.toContain(code);
    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toEqual({
      accountId: "account-1",
      expiresAt: new Date("2026-10-16T09:00:00.000Z"),
      token: "bearer-session-token",
    });
    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toBeNull();
  });

  test("requires the app-bound verifier before consuming a code", async () => {
    const { store } = createCodeStore();
    const { store: consumedCodes } = createConsumedCodeStore();
    const access = createTauriSessionAccess({
      codeStore: store,
      consumedCodes,
      now: () => NOW,
      randomCode: () => "bound-code",
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    const code = await access.issueCode("session-1", CODE_CHALLENGE);

    await expect(
      access.exchangeCode(code, WRONG_CODE_VERIFIER),
    ).resolves.toBeNull();
    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toEqual({
      accountId: "account-1",
      expiresAt: new Date("2026-10-16T09:00:00.000Z"),
      token: "bearer-session-token",
    });
  });

  test("rejects a code after its five-minute lifetime", async () => {
    const { store } = createCodeStore();
    const { store: consumedCodes } = createConsumedCodeStore();
    let currentTime = NOW;
    const access = createTauriSessionAccess({
      codeStore: store,
      consumedCodes,
      now: () => currentTime,
      randomCode: () => "expired-code",
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    const code = await access.issueCode("session-1", CODE_CHALLENGE);
    currentTime = new Date("2026-09-16T09:05:00.001Z");

    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toBeNull();
  });

  test("does not exchange a session that the shared Account Access policy has revoked", async () => {
    const { store } = createCodeStore();
    const { store: consumedCodes } = createConsumedCodeStore();
    let authorized = true;
    const access = createTauriSessionAccess({
      authorizeSession: async () => authorized,
      codeStore: store,
      consumedCodes,
      now: () => NOW,
      randomCode: () => "revoked-session-code",
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    const code = await access.issueCode("session-1", CODE_CHALLENGE);
    authorized = false;

    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toBeNull();
  });

  test("rejects a restored code after its consumption is recorded externally", async () => {
    const { records, store } = createCodeStore();
    const { store: consumedCodes } = createConsumedCodeStore();
    const access = createTauriSessionAccess({
      codeStore: store,
      consumedCodes,
      now: () => NOW,
      randomCode: () => "restored-code",
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    const code = await access.issueCode("session-1", CODE_CHALLENGE);
    const [identifier, record] = [...records.entries()][0] ?? [];
    if (!(identifier && record)) {
      throw new Error("Tauri code was not stored");
    }

    await expect(access.exchangeCode(code, CODE_VERIFIER)).resolves.toEqual(
      expect.objectContaining({ token: "bearer-session-token" }),
    );
    records.set(identifier, record);

    const restoredAccess = createTauriSessionAccess({
      codeStore: store,
      consumedCodes,
      now: () => NOW,
      sessions: {
        find: async () => ({
          accountId: "account-1",
          expiresAt: new Date("2026-10-16T09:00:00.000Z"),
          token: "bearer-session-token",
        }),
      },
    });

    await expect(
      restoredAccess.exchangeCode(code, CODE_VERIFIER),
    ).resolves.toBeNull();
  });
});
