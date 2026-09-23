import {
  type CompletionEffectsPreferences,
  DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
} from "@cantiara/api/completion-effects";
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

describe("Completion Effects RPC", () => {
  test("reads the disabled account default and saves one catalog choice", async () => {
    let revision = 0;
    let storedPreferences: CompletionEffectsPreferences =
      DEFAULT_COMPLETION_EFFECTS_PREFERENCES;
    const mutationCommands: Array<{
      baseRevision: number;
      clientIdempotencyKey: string;
      payload: MutationPayload;
      targetId: string;
    }> = [];
    const mutationContract: MutationContract<CompletionEffectsPreferences> = {
      replay: async () => null,
      mutate: async <TPayload extends MutationPayload>(
        command: MutationCommand<TPayload>,
        apply: MutationApply<CompletionEffectsPreferences, TPayload>,
      ) => {
        if (command.kind !== "human") {
          throw new Error("Expected a human preference command.");
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
        get: async () => ({
          appearance: "Dark",
          dateFormat: "locale",
          firstDayOfWeek: "Monday",
          isSaved: false,
          locale: "en-GB",
          revision: 0,
          savedAt: null,
          timeZone: "Europe/Istanbul",
        }),
      },
      completionEffectsPreferences: {
        get: async () => ({
          ...storedPreferences,
          isSaved: revision > 0,
          revision,
          savedAt: revision > 0 ? "2026-09-16T09:00:00.000Z" : null,
        }),
      },
      completionEffectsPreferencesMutationContract: mutationContract,
      auth: null,
      db: {} as Context["db"],
      githubAvailability: { getStatus: () => "available" as const },
      session: {
        session: { id: "current-session" },
        user: { id: "account-1" },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.completionEffectsPreferences()).resolves.toEqual({
      ...DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
      isSaved: false,
      revision: 0,
      savedAt: null,
    });
    await expect(
      client.saveCompletionEffectsPreferences({
        baseRevision: 0,
        clientIdempotencyKey: "completion-effects-key-1",
        preferences: {
          enabled: true,
          palette: "Loom",
          theme: "Weave",
        },
      }),
    ).resolves.toEqual({
      enabled: true,
      isSaved: true,
      palette: "Loom",
      revision: 1,
      savedAt: "2026-09-16T09:00:00.000Z",
      theme: "Weave",
    });
    expect(mutationCommands).toEqual([
      {
        baseRevision: 0,
        clientIdempotencyKey: "completion-effects-key-1",
        payload: { enabled: true, palette: "Loom", theme: "Weave" },
        targetId: "account-1",
      },
    ]);
  });
});
