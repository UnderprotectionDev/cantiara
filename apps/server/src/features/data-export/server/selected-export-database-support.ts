import type {
  ExportCustomFieldDefinition,
  ExportScope,
  ExportSubject,
} from "@cantiara/api/data-export";
import { ExportError } from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { project } from "@cantiara/db/schema/project";
import { and, eq, inArray, isNull } from "drizzle-orm";

/** The access check every database source reader starts with: own Project only. */
export async function ownsProject(
  database: Database,
  accountId: string,
  projectId: string,
): Promise<boolean> {
  const [owned] = await database
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  return Boolean(owned);
}

/** A filter the record type does not support is refused, never ignored. */
export function refuseUnsupportedFilters(
  input: { filters: Record<string, string>; recordType: ExportSubject },
  supportedFilters: readonly string[] = [],
): void {
  for (const key of Object.keys(input.filters)) {
    if (!supportedFilters.includes(key)) {
      throw new ExportError(
        "source_unavailable",
        `The filter ${key} is not supported for ${input.recordType}.`,
      );
    }
  }
}

/**
 * The guard every database source reader starts with: it refuses a filter the
 * type does not support, then answers whether the scope is the account's own.
 * `null` means the scope is not accessible (the seam reports it as such);
 * otherwise it is the readable Project id.
 */
export async function guardExportRead(
  database: Database,
  input: {
    accountId: string;
    filters: Record<string, string>;
    recordType: ExportSubject;
    scope: ExportScope;
  },
  supportedFilters: readonly string[] = [],
): Promise<string | null> {
  refuseUnsupportedFilters(input, supportedFilters);
  const projectId = projectScopeId(input.scope, input.recordType);
  return (await ownsProject(database, input.accountId, projectId))
    ? projectId
    : null;
}

/** A Project reader answers only a Project scope; any other scope is refused. */
export function projectScopeId(
  scope: ExportScope,
  recordType: ExportSubject,
): string {
  if (scope.kind !== "project") {
    throw new ExportError(
      "source_unavailable",
      `${recordType} is exported per Project, not for a Workspace scope.`,
    );
  }
  return scope.projectId;
}

/**
 * Selected-scope custom field definitions for one record type, and the values
 * of the selected records. Read-only; definitions in Trash are not carried.
 */
export async function readCustomFields(
  database: Database,
  projectId: string,
  recordTypes: string | readonly string[],
  recordIds: readonly string[],
) {
  const wanted = typeof recordTypes === "string" ? [recordTypes] : recordTypes;
  const rows = await database
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.projectId, projectId),
        isNull(customFieldDefinition.trashedAt),
      ),
    );
  const definitions: ExportCustomFieldDefinition[] = rows
    .filter((row) => wanted.some((type) => row.recordTypes.includes(type)))
    .map((row) => ({
      id: row.id,
      name: row.name,
      options: row.options,
      recordTypes: row.recordTypes,
      type: row.type,
    }));
  const values = new Map<string, Record<string, unknown>>();
  if (definitions.length > 0 && recordIds.length > 0) {
    const valueRows = await database
      .select()
      .from(customFieldValue)
      .where(
        and(
          inArray(
            customFieldValue.definitionId,
            definitions.map((definition) => definition.id),
          ),
          inArray(customFieldValue.recordId, [...recordIds]),
        ),
      );
    for (const row of valueRows) {
      const forRecord = values.get(row.recordId) ?? {};
      forRecord[row.definitionId] = row.value;
      values.set(row.recordId, forRecord);
    }
  }
  return { definitions, values };
}
