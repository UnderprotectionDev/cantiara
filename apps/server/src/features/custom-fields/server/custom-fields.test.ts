import {
  type CreateCustomFieldInput,
  CUSTOM_FIELD_TYPE_OPTIONS,
  type CustomFieldDefinition,
  type CustomFieldStore,
} from "@cantiara/api/custom-fields";
import { describe, expect, test } from "vitest";

import {
  CustomFieldNameConflictError,
  type CustomFieldsAccess,
  createCustomFields,
} from "./custom-fields";

function createMemoryStore() {
  const definitions = new Map<string, CustomFieldDefinition>();
  let sequence = 0;

  const store: CustomFieldStore = {
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
        type: input.type,
        updatedAt: now,
      };
      definitions.set(`${workspaceId}:${definition.id}`, definition);
      return Promise.resolve(definition);
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
  };

  return store;
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
        store: createMemoryStore(),
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
    const access = createCustomFields({ store });

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

  test("rejects a duplicate name only inside the same Project", async () => {
    const access = createCustomFields({ store: createMemoryStore() });

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
});
