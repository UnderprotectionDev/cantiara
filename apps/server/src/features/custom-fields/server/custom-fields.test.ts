import {
  type CreateCustomFieldInput,
  CUSTOM_FIELD_TYPE_OPTIONS,
  type CustomFieldDefinition,
  type CustomFieldStore,
  type CustomFieldValueRecord,
  customFieldValuePayloadSchema,
} from "@cantiara/api/custom-fields";
import { describe, expect, test } from "vitest";

import {
  assertValueMatchesDefinition,
  CustomFieldNameConflictError,
  type CustomFieldsAccess,
  CustomFieldValueTypeMismatchError,
  createCustomFields,
} from "./custom-fields";

const INVALID_OPTION_MESSAGE = /not an available option/;

function createMemoryStore() {
  const definitions = new Map<string, CustomFieldDefinition>();
  const values = new Map<string, CustomFieldValueRecord>();
  let sequence = 0;

  const store: CustomFieldStore = {
    countOptionUsage: (workspaceId, definitionId, option) => {
      const definition = [...definitions.values()].find(
        (candidate) => candidate.id === definitionId,
      );
      if (!definition || workspaceId !== "workspace-1") {
        return Promise.resolve(null);
      }
      let total = 0;
      for (const [key, record] of values) {
        if (!key.startsWith(`${definitionId}:`)) {
          continue;
        }
        if (
          (record.value.kind === "option" && record.value.option === option) ||
          (record.value.kind === "options" &&
            record.value.options.includes(option))
        ) {
          total += 1;
        }
      }
      return Promise.resolve(total);
    },
    create: (workspaceId, input) => {
      const duplicate = [...definitions.values()].find(
        (existingDefinition) =>
          existingDefinition.projectId === input.projectId &&
          existingDefinition.name.toLocaleLowerCase("en-US") ===
            input.name.toLocaleLowerCase("en-US"),
      );
      if (duplicate) {
        throw new CustomFieldNameConflictError(input.name);
      }

      sequence += 1;
      const now = `2026-09-19T09:00:0${sequence}.000Z`;
      const definition: CustomFieldDefinition = {
        createdAt: now,
        id: `field-${sequence}`,
        name: input.name,
        options: input.options ?? [],
        projectId: input.projectId,
        recordTypes: [...input.recordTypes],
        revision: 0,
        trashedAt: null,
        type: input.type,
        updatedAt: now,
      };
      definitions.set(`${workspaceId}:${definition.id}`, definition);
      return Promise.resolve(definition);
    },
    copyDefinitions: (workspaceId, input) => {
      if (
        workspaceId !== "workspace-1" ||
        input.sourceProjectId === input.targetProjectId
      ) {
        return Promise.resolve(null);
      }
      const copied = [...definitions.values()]
        .filter(
          (definition) =>
            definition.projectId === input.sourceProjectId &&
            definition.trashedAt === null,
        )
        .map((definition) => {
          sequence += 1;
          const timestamp = `2026-09-19T09:00:0${sequence}.000Z`;
          const clone: CustomFieldDefinition = {
            ...definition,
            createdAt: timestamp,
            id: `field-${sequence}`,
            projectId: input.targetProjectId,
            revision: 0,
            updatedAt: timestamp,
          };
          definitions.set(`workspace-1:${clone.id}`, clone);
          return clone;
        });
      return Promise.resolve(copied);
    },
    findWorkspaceId: (accountId) =>
      Promise.resolve(accountId === "account-1" ? "workspace-1" : null),
    list: (workspaceId, projectId) => {
      const hasProject = projectId === "project-1" || projectId === "project-2";
      if (!hasProject) {
        return Promise.resolve(null);
      }
      return Promise.resolve(
        [...definitions.values()].filter(
          (definition) =>
            definition.projectId === projectId && workspaceId === "workspace-1",
        ),
      );
    },
    listValues: (workspaceId, projectId, recordType, recordId) => {
      const hasProject = projectId === "project-1" || projectId === "project-2";
      if (!hasProject || workspaceId !== "workspace-1") {
        return Promise.resolve(null);
      }
      const items = [...definitions.values()]
        .filter(
          (definition) =>
            definition.projectId === projectId &&
            definition.trashedAt === null &&
            definition.recordTypes.includes(recordType),
        )
        .sort((first, second) =>
          first.createdAt.localeCompare(second.createdAt),
        );
      return Promise.resolve(
        items.map((definition) => ({
          definition,
          value: values.get(`${definition.id}:${recordId}`) ?? null,
        })),
      );
    },
    listSearchFields: (workspaceId, projectId, recordType) => {
      if (workspaceId !== "workspace-1") {
        return Promise.resolve(null);
      }
      return Promise.resolve(
        [...definitions.values()].filter(
          (definition) =>
            definition.projectId === projectId &&
            definition.trashedAt === null &&
            definition.recordTypes.includes(recordType),
        ),
      );
    },
  };

  return { definitions, store, values };
}

function fieldInput(
  type: (typeof CUSTOM_FIELD_TYPE_OPTIONS)[number],
): CreateCustomFieldInput {
  return {
    name: `${type} field`,
    options:
      type === "Single select" || type === "Multi select"
        ? ["Ready", "Later"]
        : undefined,
    projectId: "project-1",
    recordTypes: ["Work", "Feedback"],
    type,
  };
}

describe("Project Custom Fields seam", () => {
  test.each(CUSTOM_FIELD_TYPE_OPTIONS)(
    "creates and lists the project-local %s definition",
    async (type) => {
      const access: CustomFieldsAccess = createCustomFields({
        store: createMemoryStore().store,
      });

      const definition = await access.create("account-1", fieldInput(type));

      expect(definition).toMatchObject({
        name: `${type} field`,
        projectId: "project-1",
        recordTypes: ["Work", "Feedback"],
        type,
      });
      await expect(access.list("account-1", "project-1")).resolves.toEqual([
        definition,
      ]);
    },
  );

  test("keeps same-named fields independent between Projects", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });

    const first = await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
    });
    const second = await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
      projectId: "project-2",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.projectId).toBe("project-1");
    expect(second.projectId).toBe("project-2");
  });

  test("offers only active fields bound to the requested search record type", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });

    await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
      recordTypes: ["Work"],
    });
    const archived = await access.create("account-1", {
      ...fieldInput("Boolean"),
      name: "Archived review",
      recordTypes: ["Work"],
    });
    await access.create("account-1", {
      ...fieldInput("Number"),
      name: "Severity",
      recordTypes: ["Risk"],
    });
    store.definitions.set(`workspace-1:${archived.id}`, {
      ...archived,
      trashedAt: "2026-09-19T10:00:00.000Z",
    });

    await expect(
      access.searchFields("account-1", {
        projectId: "project-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([
      expect.objectContaining({ name: "Audience", recordTypes: ["Work"] }),
    ]);
    await expect(
      access.searchFields("account-1", {
        projectId: "project-1",
        recordType: "Risk",
      }),
    ).resolves.toMatchObject([{ name: "Severity", recordTypes: ["Risk"] }]);
  });

  test("copies definitions with new identity and without source values", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });
    const source = await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
      recordTypes: ["Work"],
    });
    store.values.set(`${source.id}:work-1`, {
      createdAt: "2026-09-19T09:00:09.000Z",
      definitionId: source.id,
      id: "value-1",
      recordId: "work-1",
      recordType: "Work",
      revision: 1,
      updatedAt: "2026-09-19T09:00:09.000Z",
      value: { kind: "text", text: "Founders" },
    });

    const [clone] =
      (await access.copyDefinitions("account-1", {
        sourceProjectId: "project-1",
        targetProjectId: "project-2",
      })) ?? [];

    expect(clone).toMatchObject({
      name: "Audience",
      projectId: "project-2",
      recordTypes: ["Work"],
      revision: 0,
      trashedAt: null,
      type: "Text",
    });
    expect(clone?.id).not.toBe(source.id);
    await expect(
      access.values("account-1", {
        projectId: "project-2",
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([{ definition: clone, value: null }]);
  });

  test("rejects a duplicate name only inside the same Project", async () => {
    const access = createCustomFields({ store: createMemoryStore().store });

    await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
    });
    await expect(
      access.create("account-1", {
        ...fieldInput("Number"),
        name: " audience ",
      }),
    ).rejects.toBeInstanceOf(CustomFieldNameConflictError);
  });

  test("keeps an unset value distinct from a Boolean false", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });
    const booleanField = await access.create("account-1", {
      ...fieldInput("Boolean"),
      name: "Shipped",
    });
    const textField = await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
    });

    const timestamp = "2026-09-19T09:00:09.000Z";
    store.values.set(`${booleanField.id}:work-1`, {
      createdAt: timestamp,
      definitionId: booleanField.id,
      id: "value-1",
      recordId: "work-1",
      recordType: "Work",
      revision: 1,
      updatedAt: timestamp,
      value: { boolean: false, kind: "boolean" },
    });

    const items = await access.values("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
    });
    expect(items).not.toBeNull();
    const [shipped, audience] = items ?? [];

    expect(shipped?.definition.id).toBe(booleanField.id);
    expect(shipped?.value?.value).toEqual({ boolean: false, kind: "boolean" });
    expect(audience?.definition.id).toBe(textField.id);
    expect(audience?.value).toBeNull();
  });

  test("does not offer a field on an unbound record type", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });
    await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
      recordTypes: ["Work"],
    });

    await expect(
      access.values("account-1", {
        projectId: "project-1",
        recordId: "risk-1",
        recordType: "Risk",
      }),
    ).resolves.toEqual([]);
  });

  test("hides a trashed definition from record surfaces without deleting its values", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });
    const definition = await access.create("account-1", {
      ...fieldInput("Text"),
      name: "Audience",
      recordTypes: ["Work"],
    });
    const timestamp = "2026-09-19T09:00:09.000Z";
    store.values.set(`${definition.id}:work-1`, {
      createdAt: timestamp,
      definitionId: definition.id,
      id: "value-1",
      recordId: "work-1",
      recordType: "Work",
      revision: 1,
      updatedAt: timestamp,
      value: { kind: "text", text: "Founders" },
    });

    await expect(
      access.values("account-1", {
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toHaveLength(1);

    store.definitions.set(`workspace-1:${definition.id}`, {
      ...definition,
      trashedAt: "2026-09-19T10:00:00.000Z",
    });
    await expect(
      access.values("account-1", {
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
      }),
    ).resolves.toEqual([]);

    store.definitions.set(`workspace-1:${definition.id}`, {
      ...definition,
      trashedAt: null,
    });
    const items = await access.values("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
    });
    const [restored] = items ?? [];
    expect(restored?.value?.value).toEqual({ kind: "text", text: "Founders" });
  });

  test("counts the stored values that use a select option", async () => {
    const store = createMemoryStore();
    const access = createCustomFields({ store: store.store });
    const single = await access.create(
      "account-1",
      fieldInput("Single select"),
    );
    const multi = await access.create("account-1", fieldInput("Multi select"));
    const timestamp = "2026-09-19T09:00:09.000Z";
    const base = {
      createdAt: timestamp,
      recordId: "work-1",
      recordType: "Work" as const,
      revision: 1,
      updatedAt: timestamp,
    };
    store.values.set(`${single.id}:work-1`, {
      ...base,
      definitionId: single.id,
      id: "value-1",
      value: { kind: "option", option: "Ready" },
    });
    store.values.set(`${multi.id}:work-1`, {
      ...base,
      definitionId: multi.id,
      id: "value-2",
      value: { kind: "options", options: ["Later", "Ready"] },
    });

    await expect(
      access.previewOptionDeletion("account-1", {
        definitionId: single.id,
        option: "Ready",
      }),
    ).resolves.toEqual({ affectedRecords: 1 });
    await expect(
      access.previewOptionDeletion("account-1", {
        definitionId: multi.id,
        option: "Ready",
      }),
    ).resolves.toEqual({ affectedRecords: 1 });
  });
});

describe("Custom field value payload guard", () => {
  const textDefinition = {
    id: "field-1",
    options: [],
    type: "Text" as const,
  };

  test("accepts a payload matching the definition type", () => {
    expect(() =>
      assertValueMatchesDefinition(textDefinition, {
        kind: "text",
        text: "Founders",
      }),
    ).not.toThrow();
  });

  test("rejects a payload of another field type", () => {
    expect(() =>
      assertValueMatchesDefinition(textDefinition, {
        kind: "number",
        number: 3,
      }),
    ).toThrow(CustomFieldValueTypeMismatchError);
  });

  test("rejects select options outside the definition catalog", () => {
    expect(() =>
      assertValueMatchesDefinition(
        { id: "field-2", options: ["Ready", "Later"], type: "Single select" },
        customFieldValuePayloadSchema.parse({
          kind: "option",
          option: "Blocked",
        }),
      ),
    ).toThrowError(INVALID_OPTION_MESSAGE);
  });
});
