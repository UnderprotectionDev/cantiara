import type {
  WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
  WORK_CONTEXT_CUSTOM_RELATION_OPTIONS,
  WorkContextCustomSectionCondition,
  WorkContextEvidenceRole,
} from "@cantiara/api/work-context";
import { WORK_STATUS_OPTIONS } from "@cantiara/api/work-lifecycle";

type ConditionKind = WorkContextCustomSectionCondition["kind"];

export interface CustomSectionValues {
  conditionKind: ConditionKind;
  evidenceRole: WorkContextEvidenceRole;
  recordType: (typeof WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS)[number];
  relation: (typeof WORK_CONTEXT_CUSTOM_RELATION_OPTIONS)[number];
  status: string;
  title: string;
}

export const CONDITION_KINDS: readonly ConditionKind[] = [
  "record-type",
  "relation",
  "evidence-role",
];

export function pickOption<T extends string>(
  options: readonly T[],
  value: string,
): T | undefined {
  return options.find((option) => option === value);
}

export function conditionFromDraft(
  values: CustomSectionValues,
): WorkContextCustomSectionCondition {
  const { conditionKind, evidenceRole, recordType, relation } = values;
  const status = pickOption(WORK_STATUS_OPTIONS, values.status) ?? null;
  switch (conditionKind) {
    case "record-type":
      return { kind: conditionKind, recordType, status };
    case "relation":
      return { kind: conditionKind, relation, status };
    case "evidence-role":
      return { evidenceRole, kind: conditionKind, status };
    default:
      throw new Error("Unsupported Work Context Card condition.");
  }
}
