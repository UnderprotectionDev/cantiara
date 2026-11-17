import {
  type ProjectSourceRecord,
  validationRecordSchema,
} from "@cantiara/api/project-source-records";
import { z } from "zod";

export type ValidationRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Validation Record" }
>;
export type ValidationDraft = Pick<
  ValidationRecord,
  "title" | "method" | "result" | "context"
>;
type ValidationContextRecord = Extract<
  ProjectSourceRecord,
  { sourceType: ValidationRecord["context"][number]["sourceType"] }
>;
export function isValidationContextRecord(
  record: ProjectSourceRecord,
): record is ValidationContextRecord {
  return (
    record.sourceType === "Assumption" ||
    record.sourceType === "Open Question" ||
    record.sourceType === "Decision"
  );
}
export type Save = (
  draft: ValidationDraft,
  record?: ValidationRecord,
) => Promise<unknown>;

/** Form schema for saving a Validation Record: a Title and a Method. */
export const validationRecordFormSchema = validationRecordSchema
  .pick({ method: true, title: true })
  .strip();

const conflictErrorSchema = z.object({ code: z.literal("CONFLICT") });

/** True when a failed save reports a stale revision of the record or its context. */
export function isConflictError(cause: unknown) {
  return conflictErrorSchema.safeParse(cause).success;
}
