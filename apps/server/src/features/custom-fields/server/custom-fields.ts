import {
  type CustomFieldDefinition,
  type CustomFieldRecordType,
  type CustomFieldStore,
  type CustomFieldsAccess,
  createCustomFieldInputSchema,
  customFieldValuesInputSchema,
  type ParsedCustomFieldValuePayload,
  previewCustomFieldOptionDeletionInputSchema,
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

export class CustomFieldNotFoundError extends Error {
  readonly code = "CUSTOM_FIELD_NOT_FOUND" as const;

  constructor(definitionId: string) {
    super(`Custom field ${definitionId} was not found.`);
    this.name = "CustomFieldNotFoundError";
  }
}

export class CustomFieldTrashedError extends Error {
  readonly code = "CUSTOM_FIELD_TRASHED" as const;

  constructor(definitionId: string) {
    super(`Custom field ${definitionId} is in configuration trash.`);
    this.name = "CustomFieldTrashedError";
  }
}

export class CustomFieldNotTrashedError extends Error {
  readonly code = "CUSTOM_FIELD_NOT_TRASHED" as const;

  constructor(definitionId: string) {
    super(
      `Custom field ${definitionId} must be in configuration trash before it is deleted permanently.`,
    );
    this.name = "CustomFieldNotTrashedError";
  }
}

export class CustomFieldRecordTypeNotBoundError extends Error {
  readonly code = "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" as const;

  constructor(definitionId: string, recordType: CustomFieldRecordType) {
    super(
      `Custom field ${definitionId} is not available on ${recordType} records.`,
    );
    this.name = "CustomFieldRecordTypeNotBoundError";
  }
}

export class CustomFieldValueTypeMismatchError extends Error {
  readonly code = "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" as const;

  constructor(definitionId: string) {
    super(`The value does not match the type of Custom field ${definitionId}.`);
    this.name = "CustomFieldValueTypeMismatchError";
  }
}

export class CustomFieldOptionInvalidError extends Error {
  readonly code = "CUSTOM_FIELD_OPTION_INVALID" as const;

  constructor(definitionId: string, option: string) {
    super(
      `"${option}" is not an available option of Custom field ${definitionId}.`,
    );
    this.name = "CustomFieldOptionInvalidError";
  }
}

export class CustomFieldOptionsNotSupportedError extends Error {
  readonly code = "CUSTOM_FIELD_OPTIONS_NOT_SUPPORTED" as const;

  constructor(definitionId: string) {
    super(
      `Only Single select and Multi select fields can define options (Custom field ${definitionId}).`,
    );
    this.name = "CustomFieldOptionsNotSupportedError";
  }
}

export class CustomFieldOptionsRequiredError extends Error {
  readonly code = "CUSTOM_FIELD_OPTIONS_REQUIRED" as const;

  constructor(definitionId: string) {
    super(
      `Single select and Multi select fields need at least one option (Custom field ${definitionId}).`,
    );
    this.name = "CustomFieldOptionsRequiredError";
  }
}

/**
 * Guards that a stored payload matches the definition's type and option
 * catalog. Shared by the value mutation adapters so writes can never record a
 * payload the definition cannot render.
 */
function hasOption(options: readonly string[], option: string) {
  return options.includes(option);
}

export function assertValueMatchesDefinition(
  definition: Pick<CustomFieldDefinition, "id" | "options" | "type">,
  payload: ParsedCustomFieldValuePayload,
): void {
  switch (payload.kind) {
    case "boolean":
      if (definition.type !== "Boolean") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      return;
    case "date":
      if (definition.type !== "Date") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      return;
    case "number":
      if (definition.type !== "Number") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      return;
    case "option":
      if (definition.type !== "Single select") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      if (!hasOption(definition.options, payload.option)) {
        throw new CustomFieldOptionInvalidError(definition.id, payload.option);
      }
      return;
    case "options":
      if (definition.type !== "Multi select") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      for (const option of payload.options) {
        if (!hasOption(definition.options, option)) {
          throw new CustomFieldOptionInvalidError(definition.id, option);
        }
      }
      return;
    case "text":
      if (definition.type !== "Text") {
        throw new CustomFieldValueTypeMismatchError(definition.id);
      }
      return;
    default:
      throw new Error("Unsupported Custom field value payload.");
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

    async previewOptionDeletion(accountId, input) {
      const parsed = previewCustomFieldOptionDeletionInputSchema.parse(input);
      const workspaceId = await workspaceIdFor(store, accountId);
      const affectedRecords = await store.countOptionUsage(
        workspaceId,
        parsed.definitionId,
        parsed.option,
      );
      if (affectedRecords === null) {
        throw new CustomFieldNotFoundError(parsed.definitionId);
      }
      return { affectedRecords };
    },

    async values(accountId, input) {
      const parsed = customFieldValuesInputSchema.parse(input);
      const workspaceId = await store.findWorkspaceId(accountId);
      if (!workspaceId) {
        return null;
      }
      return store.listValues(
        workspaceId,
        parsed.projectId,
        parsed.recordType,
        parsed.recordId,
      );
    },
  };
}
