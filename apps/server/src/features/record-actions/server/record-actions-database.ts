import type {
  ParsedCreateRecordActionInput,
  RecordAction,
  RecordActionStep,
  RecordActionsAccess,
} from "@cantiara/api/record-actions";
import {
  recordActionSchema,
  updateRecordActionInputSchema,
} from "@cantiara/api/record-actions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { recordAction } from "@cantiara/db/schema/record-action";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { assertValueMatchesDefinition } from "../../custom-fields/server/custom-fields";
import { toCustomFieldDefinition } from "../../custom-fields/server/custom-fields-database";

type RecordActionRecord = typeof recordAction.$inferSelect;
type CustomFieldStep = Extract<
  RecordActionStep,
  { kind: "custom-field-value" }
>;

export class RecordActionProjectNotFoundError extends Error {
  readonly code = "RECORD_ACTION_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "RecordActionProjectNotFoundError";
  }
}

export class RecordActionNameConflictError extends Error {
  readonly code = "RECORD_ACTION_NAME_CONFLICT" as const;

  constructor(name: string, options?: { cause?: unknown }) {
    super(
      `A Record Action named ${name} already exists in this Project.`,
      options,
    );
    this.name = "RecordActionNameConflictError";
  }
}

export class RecordActionStepUnavailableError extends Error {
  readonly code = "RECORD_ACTION_STEP_UNAVAILABLE" as const;

  constructor(definitionId: string) {
    super(
      `Custom field ${definitionId} is unavailable for this Record Action.`,
    );
    this.name = "RecordActionStepUnavailableError";
  }
}

export class RecordActionStaleRevisionError extends Error {
  readonly code = "RECORD_ACTION_STALE_REVISION" as const;

  constructor() {
    super("Record Action changed after this command started.");
    this.name = "RecordActionStaleRevisionError";
  }
}

function isUniqueNameViolation(error: unknown) {
  let current: unknown = error;
  while (current instanceof Error) {
    const { cause, code } = current as Error & {
      cause?: unknown;
      code?: unknown;
    };
    if (code === "23505") {
      return true;
    }
    current = cause;
  }
  return false;
}

function nameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

function toRecordAction(record: RecordActionRecord): RecordAction {
  return recordActionSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    revision: record.revision,
    steps: record.steps,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function ownedProject(
  database: Database,
  accountId: string,
  projectId: string,
) {
  const [row] = await database
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  return row ?? null;
}

async function ownedRecordAction(
  database: Database,
  accountId: string,
  actionId: string,
) {
  const [row] = await database
    .select({ action: recordAction })
    .from(recordAction)
    .innerJoin(project, eq(recordAction.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(recordAction.id, actionId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  return row?.action ?? null;
}

async function validateCustomFieldSteps(
  database: Database,
  projectId: string,
  steps: readonly RecordActionStep[],
) {
  const fieldSteps = steps.filter(
    (step): step is CustomFieldStep => step.kind === "custom-field-value",
  );
  if (fieldSteps.length === 0) {
    return;
  }
  const definitions = await database
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.projectId, projectId),
        inArray(
          customFieldDefinition.id,
          fieldSteps.map((step) => step.definitionId),
        ),
        isNull(customFieldDefinition.trashedAt),
      ),
    );
  const byId = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  for (const step of fieldSteps) {
    const definition = byId.get(step.definitionId);
    if (!definition?.recordTypes.includes("Work")) {
      throw new RecordActionStepUnavailableError(step.definitionId);
    }
    assertValueMatchesDefinition(
      toCustomFieldDefinition(definition),
      step.value,
    );
  }
}

export function createDatabaseRecordActions(
  database: Database,
): RecordActionsAccess {
  return {
    async create(accountId, input: ParsedCreateRecordActionInput) {
      if (!(await ownedProject(database, accountId, input.projectId))) {
        throw new RecordActionProjectNotFoundError(input.projectId);
      }
      await validateCustomFieldSteps(database, input.projectId, input.steps);
      const [created] = await database
        .insert(recordAction)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          nameKey: nameKey(input.name),
          projectId: input.projectId,
          steps: input.steps,
        })
        .onConflictDoNothing({
          target: [recordAction.projectId, recordAction.nameKey],
        })
        .returning();
      if (!created) {
        throw new RecordActionNameConflictError(input.name);
      }
      return toRecordAction(created);
    },

    async list(accountId, projectId) {
      if (!(await ownedProject(database, accountId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(recordAction)
        .where(
          and(
            eq(recordAction.projectId, projectId),
            isNull(recordAction.trashedAt),
          ),
        )
        .orderBy(asc(recordAction.createdAt), asc(recordAction.nameKey));
      return records.map(toRecordAction);
    },

    async trash(accountId, actionId, baseRevision) {
      const current = await ownedRecordAction(database, accountId, actionId);
      if (!(current && current.trashedAt === null)) {
        return null;
      }
      if (current.revision !== baseRevision) {
        throw new RecordActionStaleRevisionError();
      }
      const now = new Date();
      const [updated] = await database
        .update(recordAction)
        .set({
          revision: baseRevision + 1,
          trashedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(recordAction.id, actionId),
            eq(recordAction.revision, baseRevision),
            isNull(recordAction.trashedAt),
          ),
        )
        .returning();
      if (!updated) {
        throw new RecordActionStaleRevisionError();
      }
      return toRecordAction(updated);
    },

    async update(accountId, actionId, baseRevision, rawInput) {
      const input = updateRecordActionInputSchema.parse(rawInput);
      const current = await ownedRecordAction(database, accountId, actionId);
      if (!(current && current.trashedAt === null)) {
        return null;
      }
      if (current.revision !== baseRevision) {
        throw new RecordActionStaleRevisionError();
      }
      const nextNameKey = nameKey(input.name);
      const [conflict] = await database
        .select({ id: recordAction.id })
        .from(recordAction)
        .where(
          and(
            eq(recordAction.projectId, current.projectId),
            eq(recordAction.nameKey, nextNameKey),
            ne(recordAction.id, actionId),
          ),
        )
        .limit(1);
      if (conflict) {
        throw new RecordActionNameConflictError(input.name);
      }
      await validateCustomFieldSteps(database, current.projectId, input.steps);
      let updated: RecordActionRecord | undefined;
      try {
        const [row] = await database
          .update(recordAction)
          .set({
            name: input.name,
            nameKey: nextNameKey,
            revision: baseRevision + 1,
            steps: input.steps,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(recordAction.id, actionId),
              eq(recordAction.revision, baseRevision),
              isNull(recordAction.trashedAt),
            ),
          )
          .returning();
        updated = row;
      } catch (error) {
        if (isUniqueNameViolation(error)) {
          throw new RecordActionNameConflictError(input.name, { cause: error });
        }
        throw error;
      }
      if (!updated) {
        throw new RecordActionStaleRevisionError();
      }
      return toRecordAction(updated);
    },
  };
}
