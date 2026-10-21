import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { Context } from "@cantiara/api/context";
import {
  fingerprintMutationPayload,
  type MutationApply,
  type MutationCommand,
  type MutationContract,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

describe("Account Preferences RPC", () => {
  test("reads and saves preferences through the authenticated public interface", async () => {
    const getCalls: string[] = [];
    const mutationCommands: Array<{
      baseRevision: number;
      clientIdempotencyKey: string;
      payload: MutationPayload;
      targetId: string;
    }> = [];
    let revision = 0;
    let storedPreferences: AccountPreferences = DEFAULT_ACCOUNT_PREFERENCES;
    const conflictError = Object.assign(new Error("Conflict"), {
      code: "CONFLICT",
    });
    const staleError = Object.assign(new Error("Current value"), {
      code: "STALE_BASE_REVISION",
      currentRevision: 9,
      currentValue: {
        ...DEFAULT_ACCOUNT_PREFERENCES,
        locale: "de-DE",
      },
    });
    const mutationContract: MutationContract<AccountPreferences> = {
      replay: async () => null,
      mutate: async <TPayload extends MutationPayload>(
        command: MutationCommand<TPayload>,
        apply: MutationApply<AccountPreferences, TPayload>,
      ) => {
        if (command.kind !== "human") {
          throw new Error("Expected a human preference command.");
        }
        if (command.clientIdempotencyKey === "conflict-key") {
          throw conflictError;
        }
        if (command.clientIdempotencyKey === "stale-key") {
          throw staleError;
        }
        mutationCommands.push({
          baseRevision: command.baseRevision,
          clientIdempotencyKey: command.clientIdempotencyKey,
          payload: command.payload,
          targetId: command.targetId,
        });
        const previousValue = storedPreferences;
        const nextValue = await apply({
          committedAt: "2026-09-16T09:00:00.000Z",
          currentRevision: revision,
          currentValue: previousValue,
          payload: command.payload,
        });
        revision += 1;
        storedPreferences = nextValue;
        return {
          actor: command.actor,
          committedAt: "2026-09-16T09:00:00.000Z",
          id: `receipt-${revision}`,
          nextValue,
          origin: {
            clientIdempotencyKey: command.clientIdempotencyKey,
            kind: "human" as const,
          },
          payloadFingerprint: await fingerprintMutationPayload(command.payload),
          previousValue,
          revision,
          targetId: command.targetId,
        };
      },
    };
    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: (accountId: string) => {
          getCalls.push(accountId);
          return Promise.resolve({
            ...storedPreferences,
            isSaved: revision > 0,
            revision,
            savedAt: revision > 0 ? "2026-09-16T09:00:00.000Z" : null,
          });
        },
      },
      accountPreferencesMutationContract: mutationContract,
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
      revision: 0,
      savedAt: null,
    });
    await expect(
      client.saveAccountPreferences({
        baseRevision: 0,
        clientIdempotencyKey: "preferences-key-1",
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          appearance: "Light",
          locale: "tr-TR",
        },
      }),
    ).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Light",
      isSaved: true,
      locale: "tr-TR",
      revision: 1,
      savedAt: "2026-09-16T09:00:00.000Z",
    });
    await expect(
      client.saveAccountAppearance({
        appearance: "Dark",
        baseRevision: 1,
        clientIdempotencyKey: "appearance-key-1",
      }),
    ).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      appearance: "Dark",
      isSaved: true,
      locale: "tr-TR",
      revision: 2,
      savedAt: "2026-09-16T09:00:00.000Z",
    });

    expect(getCalls).toEqual(["account-1"]);
    expect(mutationCommands).toEqual([
      {
        baseRevision: 0,
        clientIdempotencyKey: "preferences-key-1",
        payload: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          appearance: "Light",
          locale: "tr-TR",
        },
        targetId: "account-1",
      },
      {
        baseRevision: 1,
        clientIdempotencyKey: "appearance-key-1",
        payload: { appearance: "Dark" },
        targetId: "account-1",
      },
    ]);

    await expect(
      client.saveAccountPreferences({
        baseRevision: 2,
        clientIdempotencyKey: "conflict-key",
        preferences: storedPreferences,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: {
        code: "CONFLICT",
        label: "Conflict",
        targetId: "account-1",
      },
      message: "Conflict",
      status: 409,
    });
    await expect(
      client.saveAccountPreferences({
        baseRevision: 2,
        clientIdempotencyKey: "stale-key",
        preferences: storedPreferences,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: 9,
        currentValue: { locale: "de-DE" },
        label: "Current value",
        targetId: "account-1",
      },
      message: "Current value",
      status: 412,
    });
  });
});
