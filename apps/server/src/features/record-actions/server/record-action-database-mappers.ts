import {
  type RecordAction,
  recordActionSchema,
} from "@cantiara/api/record-actions";
import type { recordAction } from "@cantiara/db/schema/record-action";

type RecordActionDatabaseRecord = typeof recordAction.$inferSelect;

export function toRecordAction(
  record: RecordActionDatabaseRecord,
): RecordAction {
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
