import type { ExportField } from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { workRelation } from "@cantiara/db/schema/relation";
import { work, workKeyAllocation } from "@cantiara/db/schema/work";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { ExportSourceReader } from "./selected-export";
import {
  guardExportRead,
  readCustomFields,
} from "./selected-export-database-support";
import {
  dedupeRelations,
  readExtraRelations,
} from "./selected-export-relations-database";

const WORK_TYPES = [
  "Feature",
  "Bug",
  "Task",
  "Research",
  "Improvement",
] as const;

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
 * rows; it never writes. Besides the field values it hands over the Work-key
 * history, origin, custom field values, relations (the seam keeps only those
 * whose both ends are selected) and the owned external execution handoffs.
 * Handoff package Markdown and request fingerprints stay in the Workspace.
 */
export function createDatabaseWorkExportSource(
  database: Database,
): ExportSourceReader {
  return {
    fields: () => WORK_FIELDS,
    async read(input) {
      const { filters, limit, recordIds, recordType } = input;
      const projectId = await guardExportRead(database, input, ["status"]);
      if (!projectId) {
        return null;
      }
      const rows = await database
        .select()
        .from(work)
        .where(
          and(
            eq(work.projectId, projectId),
            recordType === "Work"
              ? inArray(work.type, [...WORK_TYPES])
              : eq(work.type, recordType),
            isNull(work.trashedAt),
            filters.status ? eq(work.status, filters.status) : undefined,
            recordIds?.length ? inArray(work.id, [...recordIds]) : undefined,
          ),
        )
        .orderBy(asc(work.number))
        .limit(limit);
      const ids = rows.map((row) => row.id);
      const [allocations, relationRows, handoffs, custom] = ids.length
        ? await Promise.all([
            database
              .select()
              .from(workKeyAllocation)
              .where(inArray(workKeyAllocation.workId, ids))
              .orderBy(asc(workKeyAllocation.reservedAt)),
            database
              .select()
              .from(workRelation)
              .where(
                and(
                  inArray(workRelation.sourceWorkId, ids),
                  eq(workRelation.sourceRecordType, "Work"),
                  isNull(workRelation.deletedAt),
                ),
              ),
            database
              .select()
              .from(workExternalExecutionHandoff)
              .where(inArray(workExternalExecutionHandoff.workId, ids))
              .orderBy(asc(workExternalExecutionHandoff.createdAt)),
            readCustomFields(
              database,
              projectId,
              recordType === "Work" ? WORK_TYPES : recordType,
              ids,
            ),
          ])
        : [
            [],
            [],
            [],
            await readCustomFields(
              database,
              projectId,
              recordType === "Work" ? WORK_TYPES : recordType,
              [],
            ),
          ];
      const keysOf = (id: string, current: string) => {
        const keys = allocations
          .filter((row) => row.workId === id)
          .map((row) => row.key);
        return keys.includes(current) ? keys : [...keys, current];
      };
      return {
        customFieldDefinitions: custom.definitions,
        records: rows.map((row) => ({
          components: {
            externalExecutionHandoffs: handoffs
              .filter((handoff) => handoff.workId === row.id)
              .map((handoff) => ({
                cancellationReason: handoff.cancellationReason,
                constraints: handoff.constraints,
                createdAt: handoff.createdAt.toISOString(),
                executor: handoff.executor,
                expectedOutput: handoff.expectedOutput,
                id: handoff.handoffId,
                purpose: handoff.purpose,
                reconcileDecision: handoff.reconcileDecision,
                result: handoff.result,
                status: handoff.status,
              })),
          },
          customFieldValues: custom.values.get(row.id),
          id: row.id,
          keyHistory: keysOf(row.id, row.key),
          origin: workOrigin(row),
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
        relations: dedupeRelations([
          ...relationRows.map((relation) => ({
            fromRecordId: relation.sourceWorkId,
            kind: relation.kind,
            toRecordId: relation.targetRecordId,
          })),
          ...(await readExtraRelations(database, recordType, ids)),
        ]),
      };
    },
  };
}

function workOrigin(row: typeof work.$inferSelect) {
  const origin = {
    captureProvenance: row.captureProvenance ?? null,
    originComponentId: row.originComponentId,
    originLocation: row.originLocation ?? null,
    originOwnerRecordId: row.originOwnerRecordId,
    originSourceVersion: row.originSourceVersion,
    recreatedFromWorkKey: row.recreatedFromWorkKey,
  };
  return Object.values(origin).some((value) => value !== null) ? origin : null;
}
