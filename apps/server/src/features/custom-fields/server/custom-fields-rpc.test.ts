import type { Context } from "@cantiara/api/context";
import type {
  CustomFieldDefinition,
  CustomFieldMutationContracts,
  CustomFieldMutationValue,
  CustomFieldsAccess,
} from "@cantiara/api/custom-fields";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

const definition: CustomFieldDefinition = {
  createdAt: "2026-09-19T09:00:00.000Z",
  id: "field-1",
  name: "Audience",
  options: [],
  projectId: "project-1",
  recordTypes: ["Work", "Feedback"],
  revision: 1,
  type: "Text",
  updatedAt: "2026-09-19T09:00:00.000Z",
};

function createContext(
  customFields: CustomFieldsAccess,
  customFieldMutationContracts: CustomFieldMutationContracts,
): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    customFieldMutationContracts,
    customFields,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    projectShell: undefined,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

function createMutationContract() {
  const mutation: MutationContract<CustomFieldMutationValue> = {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<CustomFieldMutationValue, TPayload>,
    ) => {
      if (command.kind !== "human") {
        throw new Error("Expected a human Custom field command.");
      }
      const previousValue = { field: null };
      const nextValue = await apply({
        currentRevision: 0,
        currentValue: previousValue,
        payload: command.payload,
      });
      return {
        actor: command.actor,
        committedAt: "2026-09-19T09:00:00.000Z",
        id: "receipt-1",
        nextValue,
        origin: {
          clientIdempotencyKey: command.clientIdempotencyKey,
          kind: "human" as const,
        },
        payloadFingerprint: "0".repeat(64),
        previousValue,
        revision: 1,
        targetId: command.targetId,
      };
    },
    replay: async () => null,
  };
  return mutation;
}

describe("Project Custom Fields RPC", () => {
  test("lists project-local definitions through the authenticated interface", async () => {
    const customFields: CustomFieldsAccess = {
      create: async () => definition,
      list: async (_accountId, projectId) =>
        projectId === definition.projectId ? [definition] : [],
    };
    const client = createRouterClient(appRouter, {
      context: createContext(customFields, {
        create: () => createMutationContract(),
      }),
    });

    await expect(
      client.customFields({ projectId: "project-1" }),
    ).resolves.toEqual([definition]);
  });

  test("creates a Custom field through the Mutation Contract", async () => {
    const customFields: CustomFieldsAccess = {
      create: async () => definition,
      list: async () => [definition],
    };
    const mutation = createMutationContract();
    const client = createRouterClient(appRouter, {
      context: createContext(customFields, { create: () => mutation }),
    });

    await expect(
      client.createCustomField({
        baseRevision: 0,
        clientIdempotencyKey: "create-field-1",
        name: "Audience",
        projectId: "project-1",
        recordTypes: ["Work", "Feedback"],
        type: "Text",
      }),
    ).resolves.toMatchObject({
      name: "Audience",
      projectId: "project-1",
      recordTypes: ["Work", "Feedback"],
      type: "Text",
    });
  });

  test("does not expose an unsupported field type or binding", async () => {
    const customFields: CustomFieldsAccess = {
      create: async () => definition,
      list: async () => [definition],
    };
    const client = createRouterClient(appRouter, {
      context: createContext(customFields, {
        create: () => createMutationContract(),
      }),
    });

    await expect(
      client.createCustomField({
        baseRevision: 0,
        clientIdempotencyKey: "create-field-unsupported",
        name: "Derived value",
        projectId: "project-1",
        recordTypes: ["Session Test"] as never,
        type: "Formula" as never,
      }),
    ).rejects.toThrow();
  });
});
