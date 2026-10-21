import type { Context } from "@cantiara/api/context";
import type {
  CustomFieldDefinition,
  CustomFieldMutationContracts,
  CustomFieldMutationValue,
  CustomFieldsAccess,
  CustomFieldValueMutationValue,
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
  trashedAt: null,
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

function createFieldMutationContract(): MutationContract<CustomFieldMutationValue> {
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
        committedAt: "2026-09-19T09:00:00.000Z",
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

function createValueMutationContract(): MutationContract<CustomFieldValueMutationValue> {
  const mutation: MutationContract<CustomFieldValueMutationValue> = {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<CustomFieldValueMutationValue, TPayload>,
    ) => {
      if (command.kind !== "human") {
        throw new Error("Expected a human Custom field command.");
      }
      const previousValue = { value: null };
      const nextValue = await apply({
        committedAt: "2026-09-19T09:00:00.000Z",
        currentRevision: 0,
        currentValue: previousValue,
        payload: command.payload,
      });
      return {
        actor: command.actor,
        committedAt: "2026-09-19T09:00:00.000Z",
        id: "receipt-2",
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

function createContracts(recorded: {
  valueTargets: string[];
}): CustomFieldMutationContracts {
  return {
    clearValue: () => createValueMutationContract(),
    create: () => createFieldMutationContract(),
    delete: () => createFieldMutationContract(),
    restore: () => createFieldMutationContract(),
    setValue: () => {
      const contract = createValueMutationContract();
      return {
        ...contract,
        mutate: (command, apply, options) => {
          recorded.valueTargets.push(command.targetId);
          return contract.mutate(command, apply, options);
        },
      } as MutationContract<CustomFieldValueMutationValue>;
    },
    trash: () => createFieldMutationContract(),
    update: () => createFieldMutationContract(),
  };
}

function createAccess(): CustomFieldsAccess {
  return {
    copyDefinitions: async () => [definition],
    create: async () => definition,
    list: async () => [definition],
    previewOptionDeletion: async () => ({ affectedRecords: 0 }),
    projectValues: async () => ({
      definitions: [definition],
      values: [],
    }),
    searchFields: async (_accountId, input) =>
      input.recordType === "Work" ? [definition] : [],
    values: async (_accountId, input) =>
      input.projectId === definition.projectId
        ? [{ definition, value: null }]
        : [],
  };
}

describe("Project Custom Fields RPC", () => {
  test("lists project-local definitions through the authenticated interface", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.customFields({ projectId: "project-1" }),
    ).resolves.toEqual([definition]);
  });

  test("lists the bound definitions and values for a record", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.customFieldValues({
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([{ definition, value: null }]);
  });

  test("copies project-local definitions through the authenticated interface", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.copyCustomFieldDefinitions({
        sourceProjectId: "project-1",
        targetProjectId: "project-2",
      }),
    ).resolves.toEqual([definition]);
  });

  test("surfaces a copy name conflict through the shared error contract", async () => {
    const conflictAccess: CustomFieldsAccess = {
      ...createAccess(),
      copyDefinitions: () => {
        throw Object.assign(
          new Error(
            "A Custom field named Audience already exists in this Project.",
          ),
          { code: "CUSTOM_FIELD_NAME_CONFLICT" },
        );
      },
    };
    const client = createRouterClient(appRouter, {
      context: createContext(
        conflictAccess,
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.copyCustomFieldDefinitions({
        sourceProjectId: "project-1",
        targetProjectId: "project-2",
      }),
    ).rejects.toThrow(
      "A Custom field named Audience already exists in this Project.",
    );
  });

  test("lists Project-scoped Custom field values for record surfaces", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.customFieldProjectValues({
        projectId: "project-1",
        recordType: "Work",
      }),
    ).resolves.toEqual({ definitions: [definition], values: [] });
  });

  test("offers bound definitions to the search and filter seam", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.customFieldSearchFields({
        projectId: "project-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([definition]);
  });

  test("creates a Custom field through the Mutation Contract", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
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

  test("sets a value on the composite definition/record target", async () => {
    const recorded = { valueTargets: [] as string[] };
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess(), createContracts(recorded)),
    });

    await expect(
      client.setCustomFieldValue({
        baseRevision: 0,
        clientIdempotencyKey: "set-value-1",
        definitionId: "field-1",
        payload: { kind: "text", text: "Founders" },
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toMatchObject({
      definitionId: "field-1",
      recordId: "work-1",
      recordType: "Work",
      value: { kind: "text", text: "Founders" },
    });
    expect(recorded.valueTargets).toEqual(["field-1:work-1"]);
  });

  test("previews the records affected by deleting a select option", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
    });

    await expect(
      client.previewCustomFieldOptionDeletion({
        definitionId: "field-1",
        option: "Ready",
      }),
    ).resolves.toEqual({ affectedRecords: 0 });
  });

  test("does not expose an unsupported field type or binding", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(
        createAccess(),
        createContracts({ valueTargets: [] }),
      ),
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
