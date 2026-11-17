import {
  closeTestGapInputSchema,
  createTestGapInputSchema,
  type TestGapRelationInput,
  type TestGapRelationTargetType,
  type TestGapRelationView,
  testGapCaseBindInputSchema,
  testGapHandoffBindInputSchema,
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

export interface CloseFormValues {
  decisionId: string;
  outcome: "Met by result" | "Not needed";
  rationale: string;
  sessionTestIds: string[];
}

export const EMPTY_CLOSE_FORM: CloseFormValues = {
  decisionId: "",
  outcome: "Met by result",
  rationale: "",
  sessionTestIds: [],
};

/** A failed parse carries a message only when the API schema wrote one. */
export type FormParse = { message?: string; ok: false } | { ok: true };

function failed(issues: readonly { message: string }[]): FormParse {
  return { message: issues[0]?.message, ok: false };
}

/** File Test Gap: the procedure's input schema, minus the Project. */
export function parseGapForm(values: GapFormValues): FormParse {
  const result = createTestGapInputSchema.omit({ projectId: true }).safeParse({
    rationale: values.rationale,
    relations: toRelationInputs(values.relations),
    title: values.title,
  });
  return result.success ? { ok: true } : failed(result.error.issues);
}

const [metByResultSchema, notNeededSchema] = closeTestGapInputSchema.options;

/** Close Test Gap: each outcome's own fields of the procedure's input schema. */
export function parseCloseForm(values: CloseFormValues): FormParse {
  const result =
    values.outcome === "Met by result"
      ? metByResultSchema
          .pick({ rationale: true, sessionTestIds: true })
          .safeParse({
            rationale: values.rationale,
            sessionTestIds: values.sessionTestIds,
          })
      : notNeededSchema.pick({ decisionId: true, rationale: true }).safeParse({
          decisionId: values.decisionId || null,
          rationale: values.rationale,
        });
  return result.success ? { ok: true } : failed(result.error.issues);
}

/** Plan with a Planned Test Case version: exact version only. */
export function parsePlanCase(
  ref: { caseId: string; version: number } | null,
): FormParse {
  const result = testGapCaseBindInputSchema
    .pick({ caseId: true, version: true })
    .safeParse(ref);
  return result.success ? { ok: true } : { ok: false };
}

/** Plan with a Test Handoff. */
export function parsePlanHandoff(handoffId: string): FormParse {
  const result = testGapHandoffBindInputSchema
    .pick({ handoffId: true })
    .safeParse({ handoffId });
  return result.success ? { ok: true } : { ok: false };
}
