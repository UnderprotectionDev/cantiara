import type {
  TestGapRelationInput,
  TestGapRelationTargetType,
  TestGapRelationView,
} from "@cantiara/api/test-gaps";

/** A relation as the form holds it: the label is display only and never sent. */
export interface RelationDraft {
  documentRevision: number | null;
  label: string;
  sectionId: string | null;
  targetId: string;
  targetType: TestGapRelationTargetType;
}

export interface GapFormValues {
  rationale: string;
  relations: RelationDraft[];
  title: string;
}

export const EMPTY_GAP_FORM: GapFormValues = {
  rationale: "",
  relations: [],
  title: "",
};

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function relationLabel(relation: TestGapRelationView) {
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

export function toRelationInputs(
  drafts: readonly RelationDraft[],
): TestGapRelationInput[] {
  return drafts.map((draft) =>
    draft.targetType === "Document"
      ? {
          documentRevision: draft.documentRevision ?? 0,
          ...(draft.sectionId ? { sectionId: draft.sectionId } : {}),
          targetId: draft.targetId,
          targetType: "Document" as const,
        }
      : { targetId: draft.targetId, targetType: draft.targetType },
  );
}
