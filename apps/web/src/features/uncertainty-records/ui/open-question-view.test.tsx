import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { OpenQuestionDetail, OpenQuestionEditor } from "./open-question-view";

const noop = () => undefined;
const save = async () => undefined;
const record = {
  id: "question-1",
  projectId: "project-1",
  sourceType: "Open Question" as const,
  title: "Preferred cadence",
  question: "Which cadence?",
  context: "Pilot",
  life: "Answered" as const,
  answer: "Weekly",
  rationale: "Three interviews",
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-09T10:00:00.000Z",
  revision: 2,
};
test("Uncertainty Records shows missing evidence without hiding the answer or blocking explicit closure", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionDetail
      evidence={[]}
      onAnswer={noop}
      onClose={save}
      record={record}
    />,
  );
  expect(html).toContain("Which cadence?");
  expect(html).toContain("Weekly");
  expect(html).toContain("Three interviews");
  expect(html).toContain("No evidence linked.");
  expect(html).toContain("No longer applicable");
  expect(html).not.toContain("Create Decision");
});
test("Uncertainty Records keeps historical answer and exact evidence visible when read-only", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionDetail
      evidence={[
        {
          documentId: "doc",
          documentRevision: 1,
          selectedText: "Pilot result",
          selectionStart: 0,
          selectionEnd: 12,
        },
      ]}
      onAnswer={noop}
      onClose={save}
      readOnly
      record={{ ...record, life: "No longer applicable" }}
    />,
  );
  expect(html).toContain("Weekly");
  expect(html).toContain("Pilot result");
  expect(html).toContain("Version 1");
  expect(html).not.toContain("<button");
});
test("Uncertainty Records answer form requires an answer and offers optional rationale and evidence", () => {
  const html = renderToStaticMarkup(
    <OpenQuestionEditor
      documents={[]}
      onCancel={noop}
      onSave={save}
      record={record}
    />,
  );
  expect(html).toContain("Answer");
  expect(html).toContain("Rationale (optional)");
  expect(html).toContain("Evidence (optional)");
  expect(html).toContain("Cancel");
});
