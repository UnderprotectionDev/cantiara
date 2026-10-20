import type {
  CreateTestHandoffInput,
  PlannedTestCaseRecord,
  TestHandoffContextRef,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";

/** A selected context record with the label the founder saw when choosing it. */
export interface ContextRefDraft {
  label: string;
  ref: TestHandoffContextRef;
}

export interface AdHocScopeDraft {
  expectedBehavior: string;
  intent: string;
}

/** Selected exact version per Planned Test Case id; absent means not selected. */
export interface TestHandoffFormValues {
  adHocScope: AdHocScopeDraft[];
  branch: string;
  build: string;
  commit: string;
  contextRefs: ContextRefDraft[];
  dueDate: string;
  environmentPreconditions: string;
  purpose: string;
  repository: string;
  selected: Record<string, number>;
  targetEnvironment: string;
  targetExecutor: string;
  title: string;
}

export const EMPTY_TEST_HANDOFF_FORM: TestHandoffFormValues = {
  adHocScope: [],
  branch: "",
  build: "",
  commit: "",
  contextRefs: [],
  dueDate: "",
  environmentPreconditions: "",
  purpose: "",
  repository: "",
  selected: {},
  targetEnvironment: "",
  targetExecutor: "",
  title: "",
};

/** Words the founder reads for a pinned context record. */
export function describeContextRef(
  ref: TestHandoffContextRef,
  label: string | null,
  sectionLabel?: string | null,
) {
  const name = label ?? ref.targetId;
  if (ref.kind === "Document") {
    let section = "";
    if (ref.sectionId) {
      if (sectionLabel === null) {
        section = ", section no longer exists";
      } else {
        section = `, section ${sectionLabel ?? ref.sectionId}`;
      }
    }
    return `Document: ${name}, revision ${ref.documentRevision}${section}`;
  }
  if (ref.kind === "Wireframe") {
    return `Wireframe: ${name}, version ${ref.wireframeVersion}`;
  }
  return `${ref.kind}: ${name}`;
}

export function formFromHandoff(
  handoff: TestHandoffRecord,
): TestHandoffFormValues {
  return {
    adHocScope: handoff.adHocScope.map(({ expectedBehavior, intent }) => ({
      expectedBehavior,
      intent,
    })),
    branch: handoff.buildContext.branch ?? "",
    build: handoff.buildContext.build ?? "",
    commit: handoff.buildContext.commit ?? "",
    contextRefs: handoff.contextRefs.map(
      ({ brokenReason: _broken, label, sectionLabel, ...ref }) => ({
        label: describeContextRef(ref, label, sectionLabel),
        ref,
      }),
    ),
    dueDate: handoff.dueDate ?? "",
    environmentPreconditions: handoff.environmentPreconditions ?? "",
    purpose: handoff.purpose,
    repository: handoff.buildContext.repository ?? "",
    selected: Object.fromEntries(
      handoff.scenarios.map(({ caseId, version }) => [caseId, version]),
    ),
    targetEnvironment: handoff.buildContext.targetEnvironment ?? "",
    targetExecutor: handoff.targetExecutor ?? "",
    title: handoff.title,
  };
}

/** Selection follows the order of the Tests list, one exact version per case. */
export function toHandoffInput(
  values: TestHandoffFormValues,
  cases: readonly PlannedTestCaseRecord[],
): Omit<CreateTestHandoffInput, "projectId"> {
  return {
    adHocScope: values.adHocScope,
    buildContext: {
      branch: values.branch,
      build: values.build,
      commit: values.commit,
      repository: values.repository,
      targetEnvironment: values.targetEnvironment,
    },
    contextRefs: values.contextRefs.map(({ ref }) => ref),
    dueDate: values.dueDate || null,
    environmentPreconditions: values.environmentPreconditions,
    purpose: values.purpose,
    scenarios: cases.flatMap((record) => {
      const version = values.selected[record.id];
      return version === undefined ? [] : [{ caseId: record.id, version }];
    }),
    targetExecutor: values.targetExecutor,
    title: values.title,
  };
}

/** Browser-only delivery of an already produced package text. */
export function downloadPackageText(
  text: string,
  type: string,
  filename: string,
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
