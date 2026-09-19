import {
  type CustomFieldStore,
  type CustomFieldsAccess,
  createCustomFieldInputSchema,
} from "@cantiara/api/custom-fields";

export type { CustomFieldsAccess } from "@cantiara/api/custom-fields";

export class CustomFieldProjectNotFoundError extends Error {
  readonly code = "CUSTOM_FIELD_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "CustomFieldProjectNotFoundError";
  }
}

export class CustomFieldNameConflictError extends Error {
  readonly code = "CUSTOM_FIELD_NAME_CONFLICT" as const;

  constructor(name: string) {
    super(`A Custom field named ${name} already exists in this Project.`);
    this.name = "CustomFieldNameConflictError";
  }
}

async function workspaceIdFor(store: CustomFieldStore, accountId: string) {
  const workspaceId = await store.findWorkspaceId(accountId);
  if (!workspaceId) {
    throw new CustomFieldProjectNotFoundError("unknown");
  }
  return workspaceId;
}

export function createCustomFields({
  store,
}: {
  store: CustomFieldStore;
}): CustomFieldsAccess {
  return {
    async create(accountId, input) {
      const parsed = createCustomFieldInputSchema.parse(input);
      const workspaceId = await workspaceIdFor(store, accountId);
      return store.create(workspaceId, parsed);
    },

    async list(accountId, projectId) {
      const workspaceId = await store.findWorkspaceId(accountId);
      if (!workspaceId) {
        return null;
      }
      return store.list(workspaceId, projectId);
    },
  };
}
