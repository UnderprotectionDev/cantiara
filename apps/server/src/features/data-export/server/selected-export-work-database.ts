import type { ExportField } from "@cantiara/api/data-export";
import { ExportError } from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { ExportSourceReader } from "./selected-export";

const WORK_FIELDS: ExportField[] = [
  { key: "key", label: "Key" },
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "description", label: "Description" },
  { key: "problemOpportunity", label: "Problem / Opportunity" },
  { key: "expectedOutcome", label: "Expected outcome" },
  { key: "effort", label: "Effort" },
  { key: "roadmapHorizon", label: "Roadmap horizon" },
  { key: "plannedStartDate", label: "Planned start date" },
  { key: "targetDate", label: "Target date" },
  { key: "nextConcreteStep", label: "Next concrete step" },
  { key: "closureResult", label: "Closure result" },
  { key: "closureReason", label: "Closure reason" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

/**
 * Read-only source of the five Work types for Selected Export. Only the
 * owning account's non-Trash Work of one Project is read, at most `limit`
 * rows; it never writes. Work relations are a later extension of this reader.
 */
export function createDatabaseWorkExportSource(
  database: Database,
): ExportSourceReader {
  return {
    fields: () => WORK_FIELDS,
    async read({ accountId, filters, limit, recordIds, recordType, scope }) {
      for (const key of Object.keys(filters)) {
        if (key !== "status") {
          throw new ExportError(
            "source_unavailable",
            `The filter ${key} is not supported for ${recordType}.`,
          );
        }
      }
      const [owned] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, scope.projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!owned) {
        return null;
      }
      const rows = await database
        .select()
        .from(work)
        .where(
          and(
            eq(work.projectId, scope.projectId),
            eq(work.type, recordType),
            isNull(work.trashedAt),
            filters.status ? eq(work.status, filters.status) : undefined,
            recordIds?.length ? inArray(work.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(work.number))
        .limit(limit);
      return {
        records: rows.map((row) => ({
          id: row.id,
          label: `${row.key} ${row.title}`,
          values: {
            closureReason: row.closureReason,
            closureResult: row.closureResult,
            createdAt: row.createdAt.toISOString(),
            description: row.description,
            effort: row.effort,
            expectedOutcome: row.expectedOutcome,
            key: row.key,
            nextConcreteStep: row.nextConcreteStep,
            plannedStartDate: row.plannedStartDate,
            problemOpportunity: row.problemOpportunity,
            roadmapHorizon: row.roadmapHorizon,
            status: row.status,
            targetDate: row.targetDate,
            title: row.title,
            type: row.type,
            updatedAt: row.updatedAt.toISOString(),
          },
        })),
        relations: [],
      };
    },
  };
}
