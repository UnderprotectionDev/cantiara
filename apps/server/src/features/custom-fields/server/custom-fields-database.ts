import {
  type CustomFieldDefinition,
  type CustomFieldRecordType,
  type CustomFieldStore,
  type CustomFieldValueRecord,
  customFieldDefinitionSchema,
  customFieldNameKey,
  customFieldValueRecordSchema,
  type ParsedCreateCustomFieldInput,
} from "@cantiara/api/custom-fields";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  CustomFieldNameConflictError,
  CustomFieldProjectNotFoundError,
  createCustomFields,
} from "./custom-fields";

type CustomFieldDatabaseRecord = typeof customFieldDefinition.$inferSelect;
type CustomFieldValueDatabaseRecord = typeof customFieldValue.$inferSelect;

/** Smallest Drizzle surface the definition writers need. */
type DefinitionWriter = Pick<Database, "insert">;

export function toCustomFieldDefinition(
  record: CustomFieldDatabaseRecord,
): CustomFieldDefinition {
  return customFieldDefinitionSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    options: record.options,
    projectId: record.projectId,
    recordTypes: record.recordTypes,
    revision: record.revision,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    type: record.type,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function toCustomFieldValueRecord(
  record: CustomFieldValueDatabaseRecord,
): CustomFieldValueRecord {
  return customFieldValueRecordSchema.parse({
    createdAt: record.createdAt.toISOString(),
    definitionId: record.definitionId,
    id: record.id,
    recordId: record.recordId,
    recordType: record.recordType,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
    value: record.value,
  });
}

/**
 * Single insert path for Custom field definitions. Both the direct store and
 * the Mutation Contract adapters share it so the conflict behavior cannot
 * drift apart.
 */
export async function insertDefinition(
  executor: DefinitionWriter,
  input: {
    committedAt?: Date;
    id: string;
    input: ParsedCreateCustomFieldInput;
    revision?: number;
  },
): Promise<CustomFieldDefinition> {
  const [created] = await executor
    .insert(customFieldDefinition)
    .values({
      ...(input.committedAt ? { createdAt: input.committedAt } : {}),
      id: input.id,
      name: input.input.name,
      nameKey: customFieldNameKey(input.input.name),
      options: input.input.options,
      projectId: input.input.projectId,
      recordTypes: [...input.input.recordTypes],
      ...(input.revision === undefined ? {} : { revision: input.revision }),
      type: input.input.type,
      ...(input.committedAt ? { updatedAt: input.committedAt } : {}),
    })
    .onConflictDoNothing({
      target: [customFieldDefinition.projectId, customFieldDefinition.nameKey],
    })
    .returning();

  if (!created) {
    throw new CustomFieldNameConflictError(input.input.name);
  }
  return toCustomFieldDefinition(created);
}

export async function findOwnedDefinition(
  database: Pick<Database, "select">,
  accountId: string,
  definitionId: string,
  { lock = false }: { lock?: boolean } = {},
): Promise<CustomFieldDatabaseRecord | null> {
  const [record] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  const workspaceId = record?.id;
  if (!workspaceId) {
    return null;
  }

  const query = database
    .select({ definition: customFieldDefinition })
    .from(customFieldDefinition)
    .innerJoin(project, eq(project.id, customFieldDefinition.projectId))
    .where(
      and(
        eq(customFieldDefinition.id, definitionId),
        eq(project.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const rows = lock
    ? await query.for("update", { of: customFieldDefinition })
    : await query;
  const [row] = rows;
  return row?.definition ?? null;
}

export function createDatabaseCustomFields(database: Database) {
  const store: CustomFieldStore = {
    async countOptionUsage(workspaceId, definitionId, option) {
      const [definitionRow] = await database
        .select({ id: customFieldDefinition.id })
        .from(customFieldDefinition)
        .innerJoin(project, eq(project.id, customFieldDefinition.projectId))
        .where(
          and(
            eq(customFieldDefinition.id, definitionId),
            eq(project.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!definitionRow) {
        return null;
      }

      const [usage] = await database
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(customFieldValue)
        .where(
          and(
            eq(customFieldValue.definitionId, definitionId),
            sql`(${customFieldValue.value} ->> 'kind' = 'option' and ${customFieldValue.value} ->> 'option' = ${option})
              or (${customFieldValue.value} ->> 'kind' = 'options' and ${customFieldValue.value} -> 'options' @> ${JSON.stringify([option])}::jsonb)`,
          ),
        );
      return usage?.total ?? 0;
    },

    copyDefinitions(workspaceId, input) {
      return database.transaction(async (transaction) => {
        const ownedProjects = await transaction
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.workspaceId, workspaceId),
              inArray(project.id, [
                input.sourceProjectId,
                input.targetProjectId,
              ]),
            ),
          );
        if (ownedProjects.length !== 2) {
          return null;
        }

        const sourceRecords = await transaction
          .select()
          .from(customFieldDefinition)
          .where(
            and(
              eq(customFieldDefinition.projectId, input.sourceProjectId),
              isNull(customFieldDefinition.trashedAt),
            ),
          )
          .orderBy(
            asc(customFieldDefinition.createdAt),
            asc(customFieldDefinition.nameKey),
          );
        const copied: CustomFieldDefinition[] = [];
        for (const sourceRecord of sourceRecords) {
          const source = toCustomFieldDefinition(sourceRecord);
          const copiedDefinition =
            // biome-ignore lint/performance/noAwaitInLoops: Structure copy preserves definition order and must surface the first target conflict deterministically.
            await insertDefinition(transaction, {
              id: crypto.randomUUID(),
              input: {
                name: source.name,
                options: source.options,
                projectId: input.targetProjectId,
                recordTypes: source.recordTypes,
                type: source.type,
              },
            });
          copied.push(copiedDefinition);
        }
        return copied;
      });
    },

    create(workspaceId, input) {
      return database.transaction(async (transaction) => {
        const [ownedProject] = await transaction
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.id, input.projectId),
              eq(project.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (!ownedProject) {
          throw new CustomFieldProjectNotFoundError(input.projectId);
        }

        return insertDefinition(transaction, {
          id: crypto.randomUUID(),
          input,
        });
      });
    },

    async findWorkspaceId(accountId) {
      const [record] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      return record?.id ?? null;
    },

    async list(workspaceId, projectId) {
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      if (!ownedProject) {
        return null;
      }

      const records = await database
        .select()
        .from(customFieldDefinition)
        .where(eq(customFieldDefinition.projectId, projectId))
        .orderBy(
          asc(customFieldDefinition.createdAt),
          asc(customFieldDefinition.nameKey),
        );
      return records.map(toCustomFieldDefinition);
    },

    async listSearchFields(workspaceId, projectId, recordType) {
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      if (!ownedProject) {
        return null;
      }

      const records = await database
        .select()
        .from(customFieldDefinition)
        .where(
          and(
            eq(customFieldDefinition.projectId, projectId),
            isNull(customFieldDefinition.trashedAt),
            sql`${customFieldDefinition.recordTypes} @> ${JSON.stringify([recordType])}::jsonb`,
          ),
        )
        .orderBy(
          asc(customFieldDefinition.createdAt),
          asc(customFieldDefinition.nameKey),
        );
      return records.map(toCustomFieldDefinition);
    },

    async listValues(
      workspaceId,
      projectId,
      recordType: CustomFieldRecordType,
      recordId,
    ) {
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      if (!ownedProject) {
        return null;
      }

      const records = await database
        .select({ definition: customFieldDefinition, value: customFieldValue })
        .from(customFieldDefinition)
        .leftJoin(
          customFieldValue,
          and(
            eq(customFieldValue.definitionId, customFieldDefinition.id),
            eq(customFieldValue.recordId, recordId),
            eq(customFieldValue.recordType, recordType),
          ),
        )
        .where(
          and(
            eq(customFieldDefinition.projectId, projectId),
            isNull(customFieldDefinition.trashedAt),
            sql`${customFieldDefinition.recordTypes} @> ${JSON.stringify([recordType])}::jsonb`,
          ),
        )
        .orderBy(
          asc(customFieldDefinition.createdAt),
          asc(customFieldDefinition.nameKey),
        );
      return records.map(({ definition, value }) => ({
        definition: toCustomFieldDefinition(definition),
        value: value ? toCustomFieldValueRecord(value) : null,
      }));
    },
  };

  return createCustomFields({ store });
}
