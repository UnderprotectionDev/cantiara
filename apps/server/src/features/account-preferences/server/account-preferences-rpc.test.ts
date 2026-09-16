import {
  type AccountPreferences,
  type AccountPreferencesSnapshot,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

describe("Account Preferences RPC", () => {
  test("reads and saves preferences through the authenticated public interface", async () => {
    const calls: Array<{ accountId: string; preferences: AccountPreferences }> =
      [];
    const appearanceCalls: Array<{
      accountId: string;
      appearance: AccountPreferences["appearance"];
    }> = [];
    const stored: AccountPreferencesSnapshot = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      savedAt: null,
    };
    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: (accountId: string) => {
          calls.push({ accountId, preferences: stored });
          return Promise.resolve(stored);
        },
        save: (accountId: string, preferences: AccountPreferences) => {
          calls.push({ accountId, preferences });
          return Promise.resolve({
            ...preferences,
            isSaved: true,
            savedAt: "2026-09-16T09:00:00.000Z",
          });
        },
        saveAppearance: (
          accountId: string,
          appearance: AccountPreferences["appearance"],
        ) => {
          appearanceCalls.push({ accountId, appearance });
          return Promise.resolve({
            ...stored,
            appearance,
            isSaved: true,
            savedAt: "2026-09-16T09:00:00.000Z",
          });
        },
      },
      auth: null,
      db: {} as Context["db"],
      githubAvailability: { getStatus: () => "available" as const },
      session: {
        session: { id: "current-session" },
        user: { id: "account-1" },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.accountPreferences()).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      savedAt: null,
    });
    await expect(
      client.saveAccountPreferences({
        ...DEFAULT_ACCOUNT_PREFERENCES,
        appearance: "Light",
        locale: "tr-TR",
      }),
    ).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Light",
      isSaved: true,
      locale: "tr-TR",
      savedAt: "2026-09-16T09:00:00.000Z",
    });
    await expect(
      client.saveAccountAppearance({ appearance: "Light" }),
    ).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Light",
      isSaved: true,
      savedAt: "2026-09-16T09:00:00.000Z",
    });

    expect(calls).toEqual([
      { accountId: "account-1", preferences: stored },
      {
        accountId: "account-1",
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          appearance: "Light",
          locale: "tr-TR",
        },
      },
    ]);
    expect(appearanceCalls).toEqual([
      { accountId: "account-1", appearance: "Light" },
    ]);
  });
});
