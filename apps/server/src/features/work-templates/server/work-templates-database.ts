import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type {
  InstantiateWorkTemplateInput,
  ParsedCreateWorkTemplateInput,
  ParsedDuplicateWorkInput,
  WorkTemplate,
  WorkTemplateCustomFieldValue,
  WorkTemplatesAccess,
} from "@cantiara/api/work-templates";
import {
  resolveWorkTemplateDates,
  updateWorkTemplateInputSchema,
  workTemplateCustomFieldValueSchema,
  workTemplateSchema,
} from "@cantiara/api/work-templates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workTemplate } from "@cantiara/db/schema/work-template";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { assertValueMatchesDefinition } from "../../custom-fields/server/custom-fields";
import { toCustomFieldDefinition } from "../../custom-fields/server/custom-fields-database";
import type { MutationDatabaseExecutor } from "../../mutation-and-undo/server/mutation-contract-database";
import type { DatabaseWorkLifecycleAccess } from "../../work-lifecycle/server/work-lifecycle-database";

type WorkTemplateRecord = typeof workTemplate.$inferSelect;

export class WorkTemplateProjectNotFoundError extends Error {
  readonly code = "WORK_TEMPLATE_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "WorkTemplateProjectNotFoundError";
  }
}

export class WorkTemplateNameConflictError extends Error {
  readonly code = "WORK_TEMPLATE_NAME_CONFLICT" as const;

  constructor(name: string, options?: { cause?: unknown }) {
    super(
      `A Work Template named ${name} already exists in this Project.`,
      options,
    );
    this.name = "WorkTemplateNameConflictError";
  }
}

export class WorkTemplateCustomFieldUnavailableError extends Error {
  readonly code = "WORK_TEMPLATE_CUSTOM_FIELD_UNAVAILABLE" as const;

  constructor(definitionId: string) {
    super(
      `Custom field ${definitionId} is unavailable for this Work Template.`,
    );
    this.name = "WorkTemplateCustomFieldUnavailableError";
  }
}

export class WorkTemplateStaleRevisionError extends Error {
  readonly code = "WORK_TEMPLATE_STALE_REVISION" as const;

  constructor() {
    super("Work Template changed after this command started.");
    this.name = "WorkTemplateStaleRevisionError";
  }
}

export class WorkDuplicateSourceStaleError extends Error {
  readonly code = "WORK_DUPLICATE_SOURCE_STALE" as const;

  constructor() {
    super("Work changed after this command started.");
    this.name = "WorkDuplicateSourceStaleError";
  }
}

function isUniqueNameViolation(error: unknown) {
  let current: unknown = error;
  while (current instanceof Error) {
    const { code, cause } = current as Error & { code?: unknown };
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

function toWorkTemplate(record: WorkTemplateRecord): WorkTemplate {
  return workTemplateSchema.parse({
    checklist: record.checklist,
    createdAt: record.createdAt.toISOString(),
    customFieldDefaults: record.customFieldDefaults,
    descriptionSkeleton: record.descriptionSkeleton,
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    relativeDates: record.relativeDates,
    revision: record.revision,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    type: record.type,
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

async function validateCustomFieldDefaults(
  database: Database,
  projectId: string,
  defaults: readonly {
    definitionId: string;
    value: WorkTemplateCustomFieldValue;
  }[],
) {
  if (defaults.length === 0) {
    return;
  }
  const records = await database
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.projectId, projectId),
        inArray(
          customFieldDefinition.id,
          defaults.map((item) => item.definitionId),
        ),
        isNull(customFieldDefinition.trashedAt),
      ),
    );
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const item of defaults) {
    const record = byId.get(item.definitionId);
    if (
      !record ||
      record.type === "Date" ||
      !record.recordTypes.includes("Work")
    ) {
      throw new WorkTemplateCustomFieldUnavailableError(item.definitionId);
    }
    assertValueMatchesDefinition(toCustomFieldDefinition(record), item.value);
  }
}

async function ownedTemplate(
  database: Database,
  accountId: string,
  templateId: string,
) {
  const [row] = await database
    .select({ template: workTemplate })
    .from(workTemplate)
    .innerJoin(project, eq(workTemplate.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(workTemplate.id, templateId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  return row?.template ?? null;
}

async function lockOwnedTemplate(
  executor: MutationDatabaseExecutor,
  accountId: string,
  templateId: string,
) {
  const [row] = await executor
    .select({ template: workTemplate })
    .from(workTemplate)
    .innerJoin(project, eq(workTemplate.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(workTemplate.id, templateId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1)
    .for("update");
  return row?.template ?? null;
}

async function lockOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
) {
  const [row] = await executor
    .select({ id: work.id, revision: work.revision })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(and(eq(work.id, workId), eq(workspace.ownerAccountId, accountId)))
    .limit(1)
    .for("update");
  return row ?? null;
}

async function copyableCustomFieldValues(
  database: Database,
  projectId: string,
  recordId: string,
) {
  const rows = await database
    .select({ definition: customFieldDefinition, value: customFieldValue })
    .from(customFieldDefinition)
    .innerJoin(
      customFieldValue,
      and(
        eq(customFieldValue.definitionId, customFieldDefinition.id),
        eq(customFieldValue.recordId, recordId),
      ),
    )
    .where(
      and(
        eq(customFieldDefinition.projectId, projectId),
        isNull(customFieldDefinition.trashedAt),
        ne(customFieldDefinition.type, "Date"),
      ),
    )
    .orderBy(
      asc(customFieldDefinition.createdAt),
      asc(customFieldDefinition.nameKey),
    );
  const copyable: {
    definitionId: string;
    name: string;
    payload: WorkTemplateCustomFieldValue;
  }[] = [];
  for (const row of rows) {
    if (
      !row.definition.recordTypes.includes("Work") ||
      row.value.recordType !== "Work"
    ) {
      continue;
    }
    const parsed = workTemplateCustomFieldValueSchema.safeParse(
      row.value.value,
    );
    if (parsed.success) {
      copyable.push({
        definitionId: row.definition.id,
        name: row.definition.name,
        payload: parsed.data,
      });
    }
  }
  return copyable;
}

export function createDatabaseWorkTemplates(
  database: Database,
  workLifecycle?: DatabaseWorkLifecycleAccess,
): WorkTemplatesAccess {
  return {
    async create(accountId, rawInput) {
      const input: ParsedCreateWorkTemplateInput = rawInput;
      if (!(await ownedProject(database, accountId, input.projectId))) {
        throw new WorkTemplateProjectNotFoundError(input.projectId);
      }
      await validateCustomFieldDefaults(
        database,
        input.projectId,
        input.customFieldDefaults,
      );
      const [created] = await database
        .insert(workTemplate)
        .values({
          checklist: input.checklist,
          customFieldDefaults: input.customFieldDefaults,
          descriptionSkeleton: input.descriptionSkeleton,
          id: crypto.randomUUID(),
          name: input.name,
          nameKey: nameKey(input.name),
          projectId: input.projectId,
          relativeDates: input.relativeDates,
          type: input.type,
        })
        .onConflictDoNothing({
          target: [workTemplate.projectId, workTemplate.nameKey],
        })
        .returning();
      if (!created) {
        throw new WorkTemplateNameConflictError(input.name);
      }
      return toWorkTemplate(created);
    },

    async list(accountId, projectId) {
      if (!(await ownedProject(database, accountId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(workTemplate)
        .where(
          and(
            eq(workTemplate.projectId, projectId),
            isNull(workTemplate.trashedAt),
          ),
        )
        .orderBy(asc(workTemplate.createdAt), asc(workTemplate.nameKey));
      return records.map(toWorkTemplate);
    },

    async instantiate(accountId, rawInput) {
      if (!workLifecycle) {
        throw new Error("Work Lifecycle is required to instantiate Work.");
      }
      const input: InstantiateWorkTemplateInput = rawInput;
      const current = await ownedTemplate(
        database,
        accountId,
        input.templateId,
      );
      if (!current) {
        return null;
      }
      const lifecycleIdempotencyKey = `work-template:${await fingerprintMutationPayload(
        {
          clientIdempotencyKey: input.clientIdempotencyKey,
          templateId: input.templateId,
        },
      )}`;
      const idempotencyPayload = {
        baseRevision: input.baseRevision,
        createDate: input.createDate,
        templateId: input.templateId,
        title: input.title,
      };
      const existing = await workLifecycle.findCreatedByIdempotencyKey(
        accountId,
        current.projectId,
        lifecycleIdempotencyKey,
        idempotencyPayload,
      );
      if (existing) {
        return existing;
      }
      if (current.trashedAt !== null) {
        return null;
      }
      if (current.revision !== input.baseRevision) {
        throw new WorkTemplateStaleRevisionError();
      }
      const template = toWorkTemplate(current);
      const dates = resolveWorkTemplateDates({
        createDate: input.createDate,
        relativeDates: template.relativeDates,
      });
      const createInput = {
        baseRevision: 0 as const,
        checklist: template.checklist.map((item) => ({
          completed: false,
          id: item.id,
          text: item.text,
        })),
        clientIdempotencyKey: lifecycleIdempotencyKey,
        description: template.descriptionSkeleton,
        plannedStartDate: dates.plannedStartDate,
        projectId: template.projectId,
        targetDate: dates.targetDate,
        title: input.title,
        type: template.type,
      };
      const customFieldValues = template.customFieldDefaults.map((item) => ({
        definitionId: item.definitionId,
        payload: item.value,
      }));
      if (!workLifecycle.createWithCustomFieldValues) {
        throw new Error(
          "Work Lifecycle cannot finalize Work Template creation.",
        );
      }
      const instantiated = await workLifecycle.createWithCustomFieldValues(
        accountId,
        createInput,
        customFieldValues,
        {
          idempotencyPayload,
          async validateFinalization(executor) {
            const locked = await lockOwnedTemplate(
              executor,
              accountId,
              input.templateId,
            );
            if (
              !locked ||
              locked.trashedAt !== null ||
              locked.revision !== input.baseRevision
            ) {
              throw new WorkTemplateStaleRevisionError();
            }
          },
        },
      );
      return (
        (await workLifecycle.find(accountId, instantiated.id)) ?? instantiated
      );
    },

    async previewDuplicate(accountId, sourceWorkId) {
      if (!workLifecycle) {
        throw new Error("Work Lifecycle is required to duplicate Work.");
      }
      const source = await workLifecycle.find(accountId, sourceWorkId);
      if (!source) {
        return null;
      }
      const fields = await copyableCustomFieldValues(
        database,
        source.projectId,
        source.id,
      );
      return {
        checklist: source.checklist.map((item) => ({
          id: item.id,
          text: item.text,
        })),
        customFields: fields.map((field) => ({
          definitionId: field.definitionId,
          name: field.name,
          value: field.payload,
        })),
        description: source.description ?? null,
        sourceRevision: source.revision,
        sourceWorkId: source.id,
        title: source.title,
        type: source.type,
      };
    },

    async duplicate(accountId, rawInput) {
      if (!workLifecycle) {
        throw new Error("Work Lifecycle is required to duplicate Work.");
      }
      if (!workLifecycle.createWithCustomFieldValues) {
        throw new Error("Work Lifecycle cannot finalize Work duplication.");
      }
      const input: ParsedDuplicateWorkInput = rawInput;
      const source = await workLifecycle.find(accountId, input.sourceWorkId);
      if (!source) {
        return null;
      }
      const fields = await copyableCustomFieldValues(
        database,
        source.projectId,
        source.id,
      );
      const selected = new Set(input.customFieldDefinitionIds);
      const customFieldValues = fields
        .filter((field) => selected.has(field.definitionId))
        .map((field) => ({
          definitionId: field.definitionId,
          payload: field.payload,
        }));
      // One-off copy carries start context only: no absolute dates, no
      // history, relations, close outcome, current status, or memberships.
      // Checklist item ids stay the source's local ids so a same-command
      // replay reconstructs an identical payload.
      const createInput = {
        baseRevision: 0 as const,
        checklist: source.checklist.map((item) => ({
          completed: false,
          id: item.id,
          text: item.text,
        })),
        clientIdempotencyKey: input.clientIdempotencyKey,
        description: source.description,
        projectId: source.projectId,
        title: source.title,
        type: source.type,
      };
      const duplicated = await workLifecycle.createWithCustomFieldValues(
        accountId,
        createInput,
        customFieldValues,
        {
          idempotencyPayload: {
            baseRevision: input.baseRevision,
            customFieldDefinitionIds: [...selected].sort(),
            sourceWorkId: input.sourceWorkId,
          },
          async validateFinalization(executor) {
            const locked = await lockOwnedWork(executor, accountId, source.id);
            if (!locked || locked.revision !== input.baseRevision) {
              throw new WorkDuplicateSourceStaleError();
            }
          },
        },
      );
      return (await workLifecycle.find(accountId, duplicated.id)) ?? duplicated;
    },

    async trash(accountId, templateId, baseRevision) {
      const current = await ownedTemplate(database, accountId, templateId);
      if (!(current && current.trashedAt === null)) {
        return null;
      }
      const now = new Date();
      const [updated] = await database
        .update(workTemplate)
        .set({
          revision: baseRevision + 1,
          trashedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(workTemplate.id, templateId),
            eq(workTemplate.revision, baseRevision),
            isNull(workTemplate.trashedAt),
          ),
        )
        .returning();
      if (!updated) {
        throw new WorkTemplateStaleRevisionError();
      }
      return toWorkTemplate(updated);
    },

    async update(accountId, templateId, baseRevision, rawInput) {
      const input = updateWorkTemplateInputSchema.parse(rawInput);
      const current = await ownedTemplate(database, accountId, templateId);
      if (!(current && current.trashedAt === null)) {
        return null;
      }
      const nextNameKey = nameKey(input.name);
      const [conflict] = await database
        .select({ id: workTemplate.id })
        .from(workTemplate)
        .where(
          and(
            eq(workTemplate.projectId, current.projectId),
            eq(workTemplate.nameKey, nextNameKey),
            ne(workTemplate.id, templateId),
          ),
        )
        .limit(1);
      if (conflict) {
        throw new WorkTemplateNameConflictError(input.name);
      }
      await validateCustomFieldDefaults(
        database,
        current.projectId,
        input.customFieldDefaults,
      );
      let updated: WorkTemplateRecord | undefined;
      try {
        const [row] = await database
          .update(workTemplate)
          .set({
            checklist: input.checklist,
            customFieldDefaults: input.customFieldDefaults,
            descriptionSkeleton: input.descriptionSkeleton,
            name: input.name,
            nameKey: nextNameKey,
            relativeDates: input.relativeDates,
            revision: baseRevision + 1,
            type: input.type,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workTemplate.id, templateId),
              eq(workTemplate.revision, baseRevision),
              isNull(workTemplate.trashedAt),
            ),
          )
          .returning();
        updated = row;
      } catch (error) {
        if (isUniqueNameViolation(error)) {
          throw new WorkTemplateNameConflictError(input.name, { cause: error });
        }
        throw error;
      }

      if (!updated) {
        throw new WorkTemplateStaleRevisionError();
      }
      return toWorkTemplate(updated);
    },
  };
}
