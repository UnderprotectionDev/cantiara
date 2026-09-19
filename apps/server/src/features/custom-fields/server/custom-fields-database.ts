import {
  type CustomFieldDefinition,
  type CustomFieldStore,
  customFieldDefinitionSchema,
  customFieldNameKey,
} from "@cantiara/api/custom-fields";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { and, asc, eq } from "drizzle-orm";

import {
  CustomFieldNameConflictError,
  CustomFieldProjectNotFoundError,
  createCustomFields,
} from "./custom-fields";

type CustomFieldDatabaseRecord = typeof customFieldDefinition.$inferSelect;

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
    type: record.type,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function createDatabaseCustomFields(database: Database) {
  const store: CustomFieldStore = {
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

        const [created] = await transaction
          .insert(customFieldDefinition)
          .values({
            id: crypto.randomUUID(),
            name: input.name,
            nameKey: customFieldNameKey(input.name),
            options: input.options,
            projectId: input.projectId,
            recordTypes: [...input.recordTypes],
            type: input.type,
          })
          .onConflictDoNothing({
            target: [
              customFieldDefinition.projectId,
              customFieldDefinition.nameKey,
            ],
          })
          .returning();

        if (!created) {
          throw new CustomFieldNameConflictError(input.name);
        }
        return toCustomFieldDefinition(created);
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
        .orderBy(asc(customFieldDefinition.createdAt));
      return records.map(toCustomFieldDefinition);
    },
  };

  return createCustomFields({ store });
}
