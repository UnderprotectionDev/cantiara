import {
  type AcceptTestReportInput,
  fileTestReportInputSchema,
  manualTestReportInputSchema,
  TEST_REPORT_RESULTS,
  type TestReportExecutorType,
  type TestReportResult,
} from "@cantiara/api/test-report";

export interface SessionTestDraft {
  notes: string;
  result: TestReportResult;
  title: string;
}

export interface TestSessionFormValues {
  executorName: string;
  executorType: TestReportExecutorType;
  executorVersion: string;
  reportedAt: string;
  summary: string;
  tests: SessionTestDraft[];
}

export const EMPTY_SESSION_TEST: SessionTestDraft = {
  notes: "",
  result: "not_reported",
  title: "",
};

export const EMPTY_TEST_SESSION_FORM: TestSessionFormValues = {
  executorName: "",
  executorType: "user",
  executorVersion: "",
  reportedAt: "",
  summary: "",
  tests: [EMPTY_SESSION_TEST],
};

export const RESULT_OPTIONS = TEST_REPORT_RESULTS;

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The manual form's part of the input schema; the Project comes from the surface. */
const manualFormSchema = manualTestReportInputSchema.omit({ projectId: true });
const importFormSchema = fileTestReportInputSchema.pick({
  content: true,
  format: true,
});

export function parseTestSessionForm(values: TestSessionFormValues) {
  const { projectId: _projectId, ...fields } = toManualInput("", values);
  return manualFormSchema.safeParse(fields);
}

export function parseTestSessionImport(input: {
  content: string;
  format: "json" | "markdown";
}) {
  return importFormSchema.safeParse(input);
}

/** The manual form only becomes a report on Save; nothing exists before that. */
export function toManualInput(
  projectId: string,
  values: TestSessionFormValues,
): Extract<AcceptTestReportInput, { ingress: "Application" }> {
  const reportedAt = optional(values.reportedAt);
  return {
    executor: {
      name: values.executorName.trim(),
      type: values.executorType,
      version: optional(values.executorVersion),
    },
    ingress: "Application",
    projectId,
    reportedAt: reportedAt ? new Date(reportedAt).toISOString() : undefined,
    summary: optional(values.summary),
    tests: values.tests.map((test) => ({
      notes: optional(test.notes),
      result: test.result,
      title: test.title.trim(),
    })),
  };
}

const MARKDOWN_FILE = /\.(md|markdown)$/i;
const JSON_FILE = /\.json$/i;

export function reportFormatOf(fileName: string): "json" | "markdown" | null {
  if (JSON_FILE.test(fileName)) {
    return "json";
  }
  return MARKDOWN_FILE.test(fileName) ? "markdown" : null;
}

/**
 * A masked review stored nothing: the message names only field paths, never
 * content, and asks for the sensitive value to be removed at its source.
 */
export function maskedReviewMessage(result: {
  findings?: { fieldPath: string }[];
  outcome: string;
}) {
  if (result.outcome !== "masked_review") {
    return null;
  }
  const paths = (result.findings ?? []).map(({ fieldPath }) => fieldPath);
  return `Nothing was saved. Possible sensitive data in: ${paths.join(", ")}. Remove it from the source and send the report again.`;
}
