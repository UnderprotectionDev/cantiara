import type { Document } from "@cantiara/api/documents";
import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  AssumptionEditor,
  ProjectAssumptionsView,
} from "./project-assumptions-view";

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
test("Uncertainty Records shows missing evidence without a transition gate or future review queue", () => {
  const html = renderToStaticMarkup(
    <ProjectAssumptionsView
      context={{ records: [record], evidence: [], readOnly: false }}
      onSave={save}
      onTransition={save}
      projectId="p1"
      selectedId="a1"
    />,
  );
  expect(html).toContain("No evidence linked.");
  expect(html).toContain(">Refuted</button>");
  expect(html).toContain(">No longer applicable</button>");
  expect(html).not.toContain("Based on");
  expect(html).not.toContain("Refuted Assumption Review");
});
test("Uncertainty Records preserves exact evidence on No longer applicable and hides writes when archived", () => {
  const html = renderToStaticMarkup(
    <ProjectAssumptionsView
      context={{
        records: [{ ...record, life: "No longer applicable" }],
        readOnly: true,
        evidence: [
          {
            id: "e1",
            assumptionId: "a1",
            documentId: "d1",
            revision: 2,
            title: "Interview",
            excerpt: "Demand confirmed",
          },
        ],
      }}
      onSave={save}
      onTransition={save}
      projectId="p1"
      selectedId="a1"
    />,
  );
  expect(html).toContain("Demand confirmed");
  expect(html).toContain("Version 2");
  expect(html).not.toContain(">Create</button>");
  expect(html).not.toContain(">Edit</button>");
});
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
