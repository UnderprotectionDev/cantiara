import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";

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
