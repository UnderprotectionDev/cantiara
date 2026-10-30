import type { ExportCustomFieldDefinition } from "@cantiara/api/data-export";
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

/**
 * Selected-scope custom field definitions for one record type, and the values
 * of the selected records. Read-only; definitions in Trash are not carried.
 */
export async function readCustomFields(
  database: Database,
  projectId: string,
  recordType: string,
  recordIds: readonly string[],
) {
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
    .filter((row) => row.recordTypes.includes(recordType))
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
