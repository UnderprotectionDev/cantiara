import type {
  PlannedTestCaseVersionRecord,
  PlannedTestChangeKind,
  PlannedTestRelationInput,
  PlannedTestRelationTargetType,
  PlannedTestRelationView,
} from "@cantiara/api/planned-tests";

/** A relation as the form holds it: the label is display only and never sent. */
export interface RelationDraft {
  documentRevision: number | null;
  label: string;
  sectionId: string | null;
  targetId: string;
  targetType: PlannedTestRelationTargetType;
}

export interface CaseFormValues {
  changeKind: PlannedTestChangeKind;
  expectedBehavior: string;
  notes: string;
  preconditions: string;
  purpose: string;
  relations: RelationDraft[];
  scope: string;
  title: string;
}

export const EMPTY_CASE_FORM: CaseFormValues = {
  changeKind: "Meaningful change",
  expectedBehavior: "",
  notes: "",
  preconditions: "",
  purpose: "",
  relations: [],
  scope: "",
  title: "",
};

export function relationLabel(relation: PlannedTestRelationView) {
  if (relation.state === "broken") {
    return `${relation.targetType}: unavailable (${relation.brokenReason ?? "No access"})`;
  }
  const parts = [`${relation.targetType}: ${relation.label ?? ""}`];
  if (relation.targetType === "Document") {
    parts.push(`revision ${relation.documentRevision ?? 0}`);
    if (relation.sectionId) {
      parts.push(
        relation.sectionLabel
          ? `section ${relation.sectionLabel}`
          : "section no longer exists",
      );
    }
  }
  return parts.join(", ");
}

export function formFromVersion(
  version: PlannedTestCaseVersionRecord,
): CaseFormValues {
  return {
    changeKind: "Meaningful change",
    expectedBehavior: version.expectedBehavior,
    notes: version.notes ?? "",
    preconditions: version.preconditions,
    purpose: version.purpose,
    relations: version.relations.map((relation) => ({
      documentRevision: relation.documentRevision,
      label: relationLabel(relation),
      sectionId: relation.sectionId,
      targetId: relation.targetId,
      targetType: relation.targetType,
    })),
    scope: version.scope,
    title: version.title,
  };
}

export function toRelationInputs(
  drafts: readonly RelationDraft[],
): PlannedTestRelationInput[] {
  return drafts.map((draft) =>
    draft.targetType === "Document"
      ? {
          documentRevision: draft.documentRevision ?? 0,
          ...(draft.sectionId ? { sectionId: draft.sectionId } : {}),
          targetId: draft.targetId,
          targetType: "Document" as const,
        }
      : {
          targetId: draft.targetId,
          targetType: draft.targetType,
        },
  );
}
