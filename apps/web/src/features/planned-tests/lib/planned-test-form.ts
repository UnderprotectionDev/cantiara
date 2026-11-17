import {
  createPlannedTestCaseInputSchema,
  type PlannedTestCaseVersionRecord,
  type PlannedTestCaseVersionRef,
  type PlannedTestChangeKind,
  type PlannedTestRelationInput,
  type PlannedTestRelationTargetType,
  type PlannedTestRelationView,
  plannedTestCaseVersionRefSchema,
  plannedTestChangeKindSchema,
  recordSessionTestInputSchema,
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

/** A failed parse carries a message only when the API schema wrote one. */
export type FormParse = { message?: string; ok: false } | { ok: true };

function firstMessage(issues: readonly { message: string }[]): FormParse {
  return { message: issues[0]?.message, ok: false };
}

/** Case and version forms: the procedure's input schema, minus the Project. */
export function parseCaseForm(
  values: CaseFormValues,
  showChangeKind: boolean,
): FormParse {
  if (showChangeKind) {
    const kind = plannedTestChangeKindSchema.safeParse(values.changeKind);
    if (!kind.success) {
      // The change kind is a constrained control, so this has no copy.
      return { ok: false };
    }
  }
  const result = createPlannedTestCaseInputSchema
    .omit({ projectId: true })
    .safeParse({
      expectedBehavior: values.expectedBehavior,
      notes: values.notes,
      preconditions: values.preconditions,
      purpose: values.purpose,
      relations: toRelationInputs(values.relations),
      scope: values.scope,
      title: values.title,
    });
  return result.success ? { ok: true } : firstMessage(result.error.issues);
}

/** The Project is added by the surface, so the schema sees a stand-in id. */
const FORM_PROJECT_ID = "form";

/** Record Session Test: the procedure schema also enforces ad hoc vs bound content. */
export function parseRecordSessionTest(values: {
  binding: PlannedTestCaseVersionRef | null;
  expectedBehavior: string;
  purpose: string;
  title: string;
}): FormParse {
  const result = recordSessionTestInputSchema.safeParse(
    values.binding
      ? {
          binding: values.binding,
          projectId: FORM_PROJECT_ID,
          title: values.title,
        }
      : { ...values, projectId: FORM_PROJECT_ID },
  );
  return result.success ? { ok: true } : firstMessage(result.error.issues);
}

/**
 * Link Session Test: one exact Planned Test Case version. The version comes
 * from a constrained control, so a failure has no copy.
 */
export function parseVersionRef(
  value: PlannedTestCaseVersionRef | null,
): FormParse {
  const result = plannedTestCaseVersionRefSchema.safeParse(value);
  return result.success ? { ok: true } : { ok: false };
}
