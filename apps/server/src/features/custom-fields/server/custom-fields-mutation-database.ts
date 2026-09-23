import {
  type CustomFieldMutationContracts,
  type CustomFieldMutationValue,
  type CustomFieldType,
  type CustomFieldValueMutationValue,
  clearCustomFieldValueInputSchema,
  createCustomFieldInputSchema,
  customFieldDefinitionSchema,
  customFieldNameKey,
  isSelectCustomFieldType,
  type ParsedCustomFieldValuePayload,
  setCustomFieldValueInputSchema,
  updateCustomFieldInputSchema,
} from "@cantiara/api/custom-fields";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  type CustomFieldValuePayload,
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { MutationIdempotencyKey } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  assertValueMatchesDefinition,
  CustomFieldNotFoundError,
  CustomFieldNotTrashedError,
  CustomFieldOptionsNotSupportedError,
  CustomFieldOptionsRequiredError,
  CustomFieldProjectNotFoundError,
  CustomFieldRecordTypeNotBoundError,
  CustomFieldTrashedError,
} from "./custom-fields";
import {
  findOwnedDefinition,
  insertDefinition,
  toCustomFieldDefinition,
  toCustomFieldValueRecord,
} from "./custom-fields-database";

type CustomFieldMutationUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<CustomFieldMutationValue>["update"]
>[1];

type DefinitionOperation = "delete" | "restore" | "trash" | "update";
type ValueOperation = "clear" | "set";
type ParsedValueMutationInput =
  | ReturnType<typeof clearCustomFieldValueInputSchema.parse>
  | ReturnType<typeof setCustomFieldValueInputSchema.parse>;

export interface CustomFieldValueFinalization {
  definitionId: string;
  payload: ParsedCustomFieldValuePayload;
}

export interface CustomFieldValueFinalizationWriter {
  apply: (
    executor: MutationDatabaseExecutor,
    input: {
      accountId: string;
      committedAt: Date;
      idempotencyKey: MutationIdempotencyKey;
      payloadFingerprint: string;
      projectId: string;
      recordId: string;
      values: readonly CustomFieldValueFinalization[];
    },
  ) => Promise<void>;
}

function emptyTarget(
  targetId: string,
): MutationTarget<CustomFieldMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { field: null },
  };
}

function valueTargetId(definitionId: string, recordId: string) {
  return `${definitionId}:${recordId}`;
}

async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function projectIsOwned(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return false;
  }
  const [ownedProject] = await executor
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return Boolean(ownedProject);
}

async function findValueRow(
  executor: MutationDatabaseExecutor,
  definitionId: string,
  recordId: string,
  lock: boolean,
) {
  const query = executor
    .select()
    .from(customFieldValue)
    .where(
      and(
        eq(customFieldValue.definitionId, definitionId),
        eq(customFieldValue.recordId, recordId),
      ),
    )
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function createDefinition(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: CustomFieldMutationUpdateInput,
) {
  const { field } = input.nextValue;
  if (!field) {
    return null;
  }
  if (!(await projectIsOwned(executor, accountId, field.projectId))) {
    throw new CustomFieldProjectNotFoundError(field.projectId);
  }

  const parsed = customFieldDefinitionSchema.parse(field);
  const created = await insertDefinition(executor, {
    committedAt: input.committedAt,
    id: parsed.id,
    input: {
      name: parsed.name,
      options: parsed.options,
      projectId: parsed.projectId,
      recordTypes: parsed.recordTypes,
      type: parsed.type,
    },
    revision: parsed.revision,
  });

  return {
    id: created.id,
    revision: created.revision,
    value: { field: created },
  } satisfies MutationTarget<CustomFieldMutationValue>;
}

/**
 * Values that used a deleted select option become empty (unset) instead of a
 * ghost label.
 */
async function clearRemovedSelectOptions(
  executor: MutationDatabaseExecutor,
  definitionId: string,
  type: string,
  previousOptions: readonly string[],
  nextOptions: readonly string[],
) {
  if (!isSelectCustomFieldType(type as CustomFieldType)) {
    return;
  }
  const removed = previousOptions.filter(
    (option) => !nextOptions.includes(option),
  );
  if (removed.length === 0) {
    return;
  }

  if (type === "Single select") {
    await executor
      .delete(customFieldValue)
      .where(
        and(
          eq(customFieldValue.definitionId, definitionId),
          sql`${customFieldValue.value} ->> 'kind' = 'option'`,
          inArray(sql`${customFieldValue.value} ->> 'option'`, removed),
        ),
      );
    return;
  }

  const rows = await executor
    .select()
    .from(customFieldValue)
    .where(
      and(
        eq(customFieldValue.definitionId, definitionId),
        sql`${customFieldValue.value} ->> 'kind' = 'options'`,
      ),
    );
  for (const row of rows) {
    const payload: CustomFieldValuePayload = row.value;
    if (payload.kind !== "options") {
      continue;
    }
    const remaining = payload.options.filter(
      (option) => !removed.includes(option),
    );
    if (remaining.length === payload.options.length) {
      continue;
    }
    if (remaining.length === 0) {
      // biome-ignore lint/performance/noAwaitInLoops: Each row can require a different delete or update query, and the transaction executor must apply them sequentially.
      await executor
        .delete(customFieldValue)
        .where(eq(customFieldValue.id, row.id));
      continue;
    }
    await executor
      .update(customFieldValue)
      .set({
        updatedAt: new Date(),
        value: { kind: "options", options: remaining },
      })
      .where(eq(customFieldValue.id, row.id));
  }
}

function createDefinitionCreateTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<CustomFieldMutationValue> {
  return {
    async find(executor, targetId, _lock, context) {
      const parsed = createCustomFieldInputSchema.safeParse(context?.payload);
      if (!parsed.success) {
        return null;
      }
      if (!(await projectIsOwned(executor, accountId, parsed.data.projectId))) {
        throw new CustomFieldProjectNotFoundError(parsed.data.projectId);
      }
      return emptyTarget(targetId);
    },

    update(executor, input) {
      return createDefinition(executor, accountId, input);
    },
  };
}

function createDefinitionMutationTarget(
  accountId: string,
  operation: DefinitionOperation,
): MutationDatabaseTargetAdapter<CustomFieldMutationValue> {
  return {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Definition lookup keeps ownership, trash state, and type-specific option validation at one mutation boundary.
    async find(executor, targetId, lock, context) {
      const record = await findOwnedDefinition(executor, accountId, targetId, {
        lock,
      });
      if (!record) {
        return null;
      }
      if (operation === "delete" && !record.trashedAt) {
        throw new CustomFieldNotTrashedError(record.id);
      }
      if (operation === "update" && context?.payload) {
        const parsed = updateCustomFieldInputSchema.safeParse(context.payload);
        if (parsed.success) {
          if (
            !isSelectCustomFieldType(record.type as CustomFieldType) &&
            parsed.data.options.length > 0
          ) {
            throw new CustomFieldOptionsNotSupportedError(record.id);
          }
          if (
            isSelectCustomFieldType(record.type as CustomFieldType) &&
            parsed.data.options.length === 0
          ) {
            throw new CustomFieldOptionsRequiredError(record.id);
          }
        }
      }
      return {
        id: record.id,
        revision: record.revision,
        value: { field: toCustomFieldDefinition(record) },
      } satisfies MutationTarget<CustomFieldMutationValue>;
    },

    async update(executor, input) {
      const record = await findOwnedDefinition(
        executor,
        accountId,
        input.targetId,
        {
          lock: true,
        },
      );
      if (!record) {
        return null;
      }
      const definitionIdentity = and(
        eq(customFieldDefinition.id, input.targetId),
        eq(customFieldDefinition.revision, input.expectedRevision),
      );

      if (operation === "delete") {
        if (!record.trashedAt) {
          throw new CustomFieldNotTrashedError(record.id);
        }
        const [deleted] = await executor
          .delete(customFieldDefinition)
          .where(definitionIdentity)
          .returning({ id: customFieldDefinition.id });
        if (!deleted) {
          return null;
        }
        // Permanent delete cascades to the stored values.
        return {
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: { field: null },
        } satisfies MutationTarget<CustomFieldMutationValue>;
      }

      const { field } = input.nextValue;
      if (!field || field.id !== record.id) {
        return null;
      }

      let updates: Partial<typeof customFieldDefinition.$inferInsert>;
      if (operation === "update") {
        updates = {
          name: field.name,
          nameKey: customFieldNameKey(field.name),
          options: field.options,
          recordTypes: [...field.recordTypes],
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        };
      } else if (operation === "trash") {
        updates = {
          revision: input.expectedRevision + 1,
          trashedAt: input.committedAt,
          updatedAt: input.committedAt,
        };
      } else {
        updates = {
          revision: input.expectedRevision + 1,
          trashedAt: null,
          updatedAt: input.committedAt,
        };
      }

      const [updated] = await executor
        .update(customFieldDefinition)
        .set(updates)
        .where(definitionIdentity)
        .returning();
      if (!updated) {
        return null;
      }

      if (operation === "update") {
        await clearRemovedSelectOptions(
          executor,
          updated.id,
          record.type,
          record.options,
          field.options,
        );
      }

      return {
        id: updated.id,
        revision: updated.revision,
        value: { field: toCustomFieldDefinition(updated) },
      } satisfies MutationTarget<CustomFieldMutationValue>;
    },
  };
}

function assertDefinitionAcceptsValue(
  record: typeof customFieldDefinition.$inferSelect,
  recordType: string,
  payload: ParsedCustomFieldValuePayload,
) {
  if (record.trashedAt) {
    throw new CustomFieldTrashedError(record.id);
  }
  if (!record.recordTypes.includes(recordType)) {
    throw new CustomFieldRecordTypeNotBoundError(
      record.id,
      recordType as never,
    );
  }
  assertValueMatchesDefinition(toCustomFieldDefinition(record), payload);
}

async function findValueMutationTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  lock: boolean,
  input: ParsedValueMutationInput,
) {
  if (valueTargetId(input.definitionId, input.recordId) !== targetId) {
    return null;
  }
  const record = await findOwnedDefinition(
    executor,
    accountId,
    input.definitionId,
    { lock },
  );
  if (!record) {
    return null;
  }
  if ("payload" in input) {
    assertDefinitionAcceptsValue(record, input.recordType, input.payload);
  } else if (!record.recordTypes.includes(input.recordType)) {
    throw new CustomFieldRecordTypeNotBoundError(
      record.id,
      input.recordType as never,
    );
  }

  const valueRow = await findValueRow(
    executor,
    input.definitionId,
    input.recordId,
    lock,
  );
  return {
    id: targetId,
    revision: valueRow?.revision ?? 0,
    value: { value: valueRow ? toCustomFieldValueRecord(valueRow) : null },
  } satisfies MutationTarget<CustomFieldValueMutationValue>;
}

function createValueMutationTarget(
  accountId: string,
  operation: ValueOperation,
): MutationDatabaseTargetAdapter<CustomFieldValueMutationValue> {
  return {
    find(executor, targetId, lock, context) {
      if (operation === "set") {
        const parsed = setCustomFieldValueInputSchema.safeParse(
          context?.payload,
        );
        return parsed.success
          ? findValueMutationTarget(
              executor,
              accountId,
              targetId,
              lock,
              parsed.data,
            )
          : Promise.resolve(null);
      }

      const parsed = clearCustomFieldValueInputSchema.safeParse(
        context?.payload,
      );
      return parsed.success
        ? findValueMutationTarget(
            executor,
            accountId,
            targetId,
            lock,
            parsed.data,
          )
        : Promise.resolve(null);
    },

    async update(executor, input) {
      const separatorIndex = input.targetId.indexOf(":");
      if (separatorIndex < 0) {
        return null;
      }
      const definitionId = input.targetId.slice(0, separatorIndex);
      const recordId = input.targetId.slice(separatorIndex + 1);
      if (!(definitionId && recordId)) {
        return null;
      }

      if (operation === "clear") {
        await executor
          .delete(customFieldValue)
          .where(
            and(
              eq(customFieldValue.definitionId, definitionId),
              eq(customFieldValue.recordId, recordId),
              eq(customFieldValue.revision, input.expectedRevision),
            ),
          );
        return {
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: { value: null },
        } satisfies MutationTarget<CustomFieldValueMutationValue>;
      }

      const next = input.nextValue.value;
      if (!next) {
        return null;
      }

      const [row] = await executor
        .insert(customFieldValue)
        .values({
          createdAt: input.committedAt,
          definitionId,
          id: next.id,
          recordId,
          recordType: next.recordType,
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
          value: next.value,
        })
        .onConflictDoUpdate({
          set: {
            revision: input.expectedRevision + 1,
            updatedAt: input.committedAt,
            value: next.value,
          },
          setWhere: eq(customFieldValue.revision, input.expectedRevision),
          target: [customFieldValue.definitionId, customFieldValue.recordId],
        })
        .returning();
      if (!row) {
        return null;
      }

      return {
        id: input.targetId,
        revision: input.expectedRevision + 1,
        value: { value: toCustomFieldValueRecord(row) },
      } satisfies MutationTarget<CustomFieldValueMutationValue>;
    },
  };
}

/**
 * Applies the Custom field part of Work creation inside the Work Mutation
 * Contract transaction. The compound command owns the commit barrier; the
 * value target above remains the source of validation and row semantics.
 */
export function createDatabaseCustomFieldFinalizationWriter(): CustomFieldValueFinalizationWriter {
  return {
    async apply(executor, input) {
      const valueTarget = createValueMutationTarget(input.accountId, "set");
      for (const draftValue of input.values) {
        // biome-ignore lint/performance/noAwaitInLoops: Custom field definitions are locked and validated in stable order inside the Work transaction.
        const definition = await findOwnedDefinition(
          executor,
          input.accountId,
          draftValue.definitionId,
          { lock: true },
        );
        if (!definition || definition.projectId !== input.projectId) {
          throw new CustomFieldNotFoundError(draftValue.definitionId);
        }

        assertDefinitionAcceptsValue(definition, "Work", draftValue.payload);
        const valueRow = await findValueRow(
          executor,
          draftValue.definitionId,
          input.recordId,
          true,
        );
        const targetId = valueTargetId(draftValue.definitionId, input.recordId);
        const updated = await valueTarget.update(executor, {
          committedAt: input.committedAt,
          expectedRevision: valueRow?.revision ?? 0,
          idempotencyKey: input.idempotencyKey,
          nextValue: {
            value: {
              createdAt:
                valueRow?.createdAt.toISOString() ??
                input.committedAt.toISOString(),
              definitionId: draftValue.definitionId,
              id: valueRow?.id ?? crypto.randomUUID(),
              recordId: input.recordId,
              recordType: "Work",
              revision: (valueRow?.revision ?? 0) + 1,
              updatedAt: input.committedAt.toISOString(),
              value: draftValue.payload,
            },
          },
          payloadFingerprint: input.payloadFingerprint,
          targetId,
        });
        if (!updated) {
          throw new Error(
            `Custom field ${draftValue.definitionId} could not be finalized.`,
          );
        }
      }
    },
  };
}

export function createDatabaseCustomFieldMutationContracts(
  database: Database,
): CustomFieldMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createDefinitionCreateTarget(accountId),
      }),
    delete: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "delete"),
      }),
    restore: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "restore"),
      }),
    setValue: (accountId) =>
      createDatabaseMutationContract<CustomFieldValueMutationValue>(database, {
        target: createValueMutationTarget(accountId, "set"),
      }),
    clearValue: (accountId) =>
      createDatabaseMutationContract<CustomFieldValueMutationValue>(database, {
        target: createValueMutationTarget(accountId, "clear"),
      }),
    trash: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "trash"),
      }),
    update: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "update"),
      }),
  };
}
