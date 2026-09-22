import {
  type BlockingRelationStatus,
  blockingRelationStatusSchema,
} from "@cantiara/api/relations";

export function relationBlockingStatus(
  kind: string,
  value: string | null | undefined,
): BlockingRelationStatus | null {
  if (kind !== "Blocks") {
    return null;
  }
  return value === null || value === undefined
    ? "Active"
    : blockingRelationStatusSchema.parse(value);
}
