import type {
  CreateTestHandoffInput,
  PlannedTestCaseRecord,
  TestHandoffRecord,
} from "@cantiara/api/planned-tests";

/** Selected exact version per Planned Test Case id; absent means not selected. */
export interface TestHandoffFormValues {
  branch: string;
  build: string;
  commit: string;
  dueDate: string;
  purpose: string;
  repository: string;
  selected: Record<string, number>;
  targetEnvironment: string;
  targetExecutor: string;
  title: string;
}

export const EMPTY_TEST_HANDOFF_FORM: TestHandoffFormValues = {
  branch: "",
  build: "",
  commit: "",
  dueDate: "",
  purpose: "",
  repository: "",
  selected: {},
  targetEnvironment: "",
  targetExecutor: "",
  title: "",
};

export function formFromHandoff(
  handoff: TestHandoffRecord,
): TestHandoffFormValues {
  return {
    branch: handoff.buildContext.branch ?? "",
    build: handoff.buildContext.build ?? "",
    commit: handoff.buildContext.commit ?? "",
    dueDate: handoff.dueDate ?? "",
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
    buildContext: {
      branch: values.branch,
      build: values.build,
      commit: values.commit,
      repository: values.repository,
      targetEnvironment: values.targetEnvironment,
    },
    dueDate: values.dueDate || null,
    purpose: values.purpose,
    scenarios: cases.flatMap((record) => {
      const version = values.selected[record.id];
      return version === undefined ? [] : [{ caseId: record.id, version }];
    }),
    targetExecutor: values.targetExecutor,
    title: values.title,
  };
}
