import {
  type CustomFieldMutationContracts,
  type CustomFieldMutationValue,
  createCustomFieldInputSchema,
  customFieldDefinitionSchema,
  customFieldNameKey,
} from "@cantiara/api/custom-fields";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  CustomFieldNameConflictError,
  CustomFieldProjectNotFoundError,
} from "./custom-fields";
import { toCustomFieldDefinition } from "./custom-fields-database";

type CustomFieldMutationUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<CustomFieldMutationValue>["update"]
>[1];

function emptyTarget(
  targetId: string,
): MutationTarget<CustomFieldMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { field: null },
  };
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
  const [created] = await executor
    .insert(customFieldDefinition)
    .values({
      createdAt: input.committedAt,
      id: parsed.id,
      name: parsed.name,
      nameKey: customFieldNameKey(parsed.name),
      options: parsed.options,
      projectId: parsed.projectId,
      recordTypes: [...parsed.recordTypes],
      revision: parsed.revision,
      type: parsed.type,
      updatedAt: input.committedAt,
    })
    .onConflictDoNothing({
      target: [customFieldDefinition.projectId, customFieldDefinition.nameKey],
    })
    .returning();

  if (!created) {
    throw new CustomFieldNameConflictError(parsed.name);
  }

  return {
    id: created.id,
    revision: created.revision,
    value: { field: toCustomFieldDefinition(created) },
  } satisfies MutationTarget<CustomFieldMutationValue>;
}

function createCustomFieldMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<CustomFieldMutationValue> {
  return {
    async find(executor, targetId, _lock, context) {
      const parsed = createCustomFieldInputSchema.safeParse(context?.payload);
      if (
        !(
          parsed.success &&
          (await projectIsOwned(executor, accountId, parsed.data.projectId))
        )
      ) {
        return null;
      }
      return emptyTarget(targetId);
    },

    update(executor, input) {
      return createDefinition(executor, accountId, input);
    },
  };
}

export function createDatabaseCustomFieldMutationContracts(
  database: Database,
): CustomFieldMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract<CustomFieldMutationValue>(database, {
        target: createCustomFieldMutationTarget(accountId),
      }),
  };
}
