import type {
  ParsedCreateWorkTemplateInput,
  WorkTemplate,
  WorkTemplateCustomFieldValue,
  WorkTemplatesAccess,
} from "@cantiara/api/work-templates";
import {
  updateWorkTemplateInputSchema,
  workTemplateSchema,
} from "@cantiara/api/work-templates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { customFieldDefinition } from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { workTemplate } from "@cantiara/db/schema/work-template";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { assertValueMatchesDefinition } from "../../custom-fields/server/custom-fields";
import { toCustomFieldDefinition } from "../../custom-fields/server/custom-fields-database";

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

export function createDatabaseWorkTemplates(
  database: Database,
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
