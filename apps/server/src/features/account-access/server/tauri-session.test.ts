import { describe, expect, test } from "vitest";

import {
  createTauriSessionAccess,
  TAURI_AUTH_CODE_IDENTIFIER_PREFIX,
  type TauriAuthCodeStore,
} from "./tauri-session";

const NOW = new Date("2026-09-16T09:00:00.000Z");

function createCodeStore() {
  const records = new Map<string, { expiresAt: Date; sessionId: string }>();
  const store: TauriAuthCodeStore = {
    consume(identifier, now) {
      const record = records.get(identifier);
      if (!record || record.expiresAt <= now) {
        return Promise.resolve(null);
      }
      records.delete(identifier);
      return Promise.resolve(record.sessionId);
    },
    create(identifier, sessionId, expiresAt) {
      records.set(identifier, { expiresAt, sessionId });
      return Promise.resolve();
    },
  };
  return { records, store };
}

describe("Account Access Tauri bearer exchange", () => {
  test("exchanges a short-lived code once and keeps the raw code out of storage", async () => {
    const { records, store } = createCodeStore();
    const access = createTauriSessionAccess({
      codeStore: store,
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

    const code = await access.issueCode("session-1");

    expect(code).toBe("one-time-code");
    const [storedIdentifier] = [...records.keys()];
    expect(storedIdentifier).toMatch(
      new RegExp(`^${TAURI_AUTH_CODE_IDENTIFIER_PREFIX}`),
    );
    expect(storedIdentifier).not.toContain(code);
    await expect(access.exchangeCode(code)).resolves.toEqual({
      accountId: "account-1",
      expiresAt: new Date("2026-10-16T09:00:00.000Z"),
      token: "bearer-session-token",
    });
    await expect(access.exchangeCode(code)).resolves.toBeNull();
  });

  test("rejects a code after its five-minute lifetime", async () => {
    const { store } = createCodeStore();
    let currentTime = NOW;
    const access = createTauriSessionAccess({
      codeStore: store,
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

    const code = await access.issueCode("session-1");
    currentTime = new Date("2026-09-16T09:05:00.001Z");

    await expect(access.exchangeCode(code)).resolves.toBeNull();
  });

  test("does not exchange a session that the shared Account Access policy has revoked", async () => {
    const { store } = createCodeStore();
    let authorized = true;
    const access = createTauriSessionAccess({
      authorizeSession: async () => authorized,
      codeStore: store,
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

    const code = await access.issueCode("session-1");
    authorized = false;

    await expect(access.exchangeCode(code)).resolves.toBeNull();
  });
});
