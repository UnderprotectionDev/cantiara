import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import type {
  DuplicateWorkInput,
  ParsedCreateWorkTemplateInput,
  WorkDuplicatePreview,
  WorkTemplate,
  WorkTemplateCustomFieldValue,
  WorkTemplatesAccess,
} from "@cantiara/api/work-templates";
import {
  duplicateWorkInputSchema,
  updateWorkTemplateInputSchema,
  workTemplateSchema,
} from "@cantiara/api/work-templates";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { workTemplate } from "@cantiara/db/schema/work-template";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { assertValueMatchesDefinition } from "../../custom-fields/server/custom-fields";
import { toCustomFieldDefinition } from "../../custom-fields/server/custom-fields-database";
import type { CustomFieldValueFinalization } from "../../custom-fields/server/custom-fields-mutation-database";

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

export class WorkDuplicatePreviewRequiredError extends Error {
  readonly code = "WORK_DUPLICATE_PREVIEW_REQUIRED" as const;

  constructor() {
    super(
      "A current Duplicate Work preview is required before creating the Work.",
    );
    this.name = "WorkDuplicatePreviewRequiredError";
  }
}

export class WorkDuplicateFieldRequiredError extends Error {
  readonly code = "WORK_DUPLICATE_FIELD_REQUIRED" as const;

  constructor(field: string) {
    super(`${field} must be selected to duplicate Work.`);
    this.name = "WorkDuplicateFieldRequiredError";
  }
}

export class WorkDuplicateCustomFieldUnavailableError extends Error {
  readonly code = "WORK_DUPLICATE_CUSTOM_FIELD_UNAVAILABLE" as const;

  constructor(definitionId: string) {
    super(`Custom field ${definitionId} is unavailable for Duplicate Work.`);
    this.name = "WorkDuplicateCustomFieldUnavailableError";
  }
}

interface WorkDuplicateLifecycle extends Pick<WorkLifecycleAccess, "find"> {
  createWithCustomFieldValues: (
    accountId: string,
    input: Parameters<WorkLifecycleAccess["create"]>[1],
    customFieldValues: readonly CustomFieldValueFinalization[],
  ) => Promise<WorkProfile>;
}

async function fingerprintDuplicatePreview(value: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function buildDuplicatePreview(
  database: Database,
  workLifecycle: WorkDuplicateLifecycle | undefined,
  accountId: string,
  sourceWorkId: string,
): Promise<WorkDuplicatePreview | null> {
  if (!workLifecycle) {
    throw new Error("Duplicate Work is unavailable.");
  }
  const sourceWork = await workLifecycle.find(accountId, sourceWorkId);
  if (!sourceWork) {
    return null;
  }
  const valueRows = await database
    .select({ definition: customFieldDefinition, value: customFieldValue })
    .from(customFieldValue)
    .innerJoin(
      customFieldDefinition,
      eq(customFieldValue.definitionId, customFieldDefinition.id),
    )
    .where(
      and(
        eq(customFieldValue.recordId, sourceWork.id),
        eq(customFieldValue.recordType, "Work"),
        eq(customFieldDefinition.projectId, sourceWork.projectId),
        isNull(customFieldDefinition.trashedAt),
        ne(customFieldDefinition.type, "Date"),
      ),
    )
    .orderBy(asc(customFieldDefinition.name), asc(customFieldDefinition.id));
  const customFields = valueRows
    .filter((row) => row.definition.recordTypes.includes("Work"))
    .map((row) => ({
      definitionId: row.definition.id,
      label: row.definition.name,
      selectedByDefault: true as const,
      type: row.definition
        .type as WorkDuplicatePreview["customFields"][number]["type"],
      value: row.value.value,
    }));
  const fields: WorkDuplicatePreview["fields"] = [
    {
      key: "title",
      label: "Title",
      selectedByDefault: true,
      value: sourceWork.title,
    },
    {
      key: "type",
      label: "Type",
      selectedByDefault: true,
      value: sourceWork.type,
    },
    {
      key: "description",
      label: "Description",
      selectedByDefault: sourceWork.description !== null,
      value: sourceWork.description,
    },
    {
      key: "checklist",
      label: "Checklist",
      selectedByDefault: sourceWork.checklist.length > 0,
      value: sourceWork.checklist,
    },
  ];
  const source = {
    id: sourceWork.id,
    key: sourceWork.key,
    revision: sourceWork.revision,
    title: sourceWork.title,
  };
  return {
    customFields,
    fields,
    previewId: await fingerprintDuplicatePreview({
      customFields,
      fields,
      sourceWork: source,
    }),
    sourceWork: source,
  };
}

function selectedDuplicateCustomFields(
  input: DuplicateWorkInput,
  preview: WorkDuplicatePreview,
) {
  if (!input.selectedFields.includes("title")) {
    throw new WorkDuplicateFieldRequiredError("Title");
  }
  const customFieldsById = new Map(
    preview.customFields.map((field) => [field.definitionId, field]),
  );
  const selectedCustomFields = [...new Set(input.selectedCustomFieldIds)].map(
    (definitionId) => {
      const field = customFieldsById.get(definitionId);
      if (!field) {
        throw new WorkDuplicateCustomFieldUnavailableError(definitionId);
      }
      return field;
    },
  );
  return selectedCustomFields;
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
  options: { workLifecycle?: WorkDuplicateLifecycle } = {},
): WorkTemplatesAccess {
  const { workLifecycle } = options;
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

    previewDuplicate(accountId, sourceWorkId) {
      return buildDuplicatePreview(
        database,
        workLifecycle,
        accountId,
        sourceWorkId,
      );
    },

    async duplicate(accountId, rawInput: DuplicateWorkInput) {
      if (!workLifecycle) {
        throw new Error("Duplicate Work is unavailable.");
      }
      const input = duplicateWorkInputSchema.parse(rawInput);
      const preview = await buildDuplicatePreview(
        database,
        workLifecycle,
        accountId,
        input.sourceWorkId,
      );
      if (!preview || preview.previewId !== input.previewId) {
        throw new WorkDuplicatePreviewRequiredError();
      }
      const sourceWork = await workLifecycle.find(
        accountId,
        input.sourceWorkId,
      );
      if (!sourceWork || sourceWork.revision !== preview.sourceWork.revision) {
        throw new WorkDuplicatePreviewRequiredError();
      }
      const selectedCustomFields = selectedDuplicateCustomFields(
        input,
        preview,
      );
      const selectedFields = new Set(input.selectedFields);
      return workLifecycle.createWithCustomFieldValues(
        accountId,
        {
          baseRevision: input.baseRevision,
          checklist: selectedFields.has("checklist")
            ? sourceWork.checklist.map((item) => ({
                ...item,
                id: crypto.randomUUID(),
              }))
            : [],
          clientIdempotencyKey: input.clientIdempotencyKey,
          description: selectedFields.has("description")
            ? sourceWork.description
            : null,
          projectId: sourceWork.projectId,
          title: sourceWork.title,
          type: selectedFields.has("type") ? sourceWork.type : "Task",
        },
        selectedCustomFields.map((field) => ({
          definitionId: field.definitionId,
          payload: field.value,
        })),
      );
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
