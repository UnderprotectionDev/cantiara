import type { Document } from "@cantiara/api/documents";
import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { AssumptionEditor } from "../assumption-editor-form";

const record: AssumptionRecord = {
  id: "a1",
  projectId: "p1",
  title: "Export demand",
  statement: "Customers need export.",
  rationale: null,
  life: "Confirmed",
  revision: 1,
  sourceType: "Assumption",
  createdAt: "2026-10-09T10:00:00Z",
  updatedAt: "2026-10-09T10:00:00Z",
};
const noop = () => undefined;
const save = async () => undefined;

test("Assumption outcome accepts an optional rationale and exact Document evidence", () => {
  const html = renderToStaticMarkup(
    <AssumptionEditor
      documents={[]}
      life="Refuted"
      onCancel={noop}
      onSave={save}
      record={record}
    />,
  );
  expect(html).toContain("Rationale (optional)");
  expect(html).toContain("Evidence (optional)");
  expect(html).toContain(">Save</button>");
  expect(html).toContain(">Cancel</button>");
});

test("Assumption outcome offers only Documents with nonempty supported text", () => {
  const documents: Document[] = [
    {
      body: "   \n\t",
      createdAt: "2026-10-09T10:00:00.000Z",
      id: "empty-document",
      projectId: "p1",
      revision: 1,
      title: "Whitespace only",
      type: "Spec",
      updatedAt: "2026-10-09T10:00:00.000Z",
    },
    {
      body: "Supported evidence",
      createdAt: "2026-10-09T10:00:00.000Z",
      id: "evidence-document",
      projectId: "p1",
      revision: 2,
      title: "Interview notes",
      type: "Spec",
      updatedAt: "2026-10-09T10:00:00.000Z",
    },
  ];
  const html = renderToStaticMarkup(
    <AssumptionEditor
      documents={documents}
      life="Confirmed"
      onCancel={noop}
      onSave={save}
      record={record}
    />,
  );

  expect(html).not.toContain("Whitespace only");
  expect(html).toContain("Interview notes — Version 2");
});
