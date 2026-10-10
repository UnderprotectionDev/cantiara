import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  ProjectRisksView,
  RiskEditor,
  type RiskRecord,
} from "./project-risks-view";

const record: RiskRecord = {
  id: "risk-1",
  projectId: "project-1",
  sourceType: "Risk",
  revision: 1,
  title: "Provider delay",
  description: "Approval may slip",
  impact: "Delayed release",
  probability: "Unknown",
  response: "Prepare fallback",
  rationale: "Known exposure",
  life: "Accepted",
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-09T10:00:00.000Z",
};
const save = async () => undefined;
const cancel = () => undefined;
const rationaleTextareaPattern = /<textarea[^>]*id="risk-rationale"[^>]*>/;
const disabledAttributePattern = /\sdisabled(?:=""|=)/;

test("Risks keeps Accepted visible with its rationale and offers explicit status changes without scores", () => {
  const html = renderToStaticMarkup(
    <ProjectRisksView
      onSave={save}
      onTransition={save}
      projectId="project-1"
      records={[record]}
      selectedId={record.id}
    />,
  );
  expect(html).toContain('aria-label="Risk"');
  expect(html).toContain("Known exposure");
  expect(html).toContain("Prepare fallback");
  expect(html).toContain(">Create</button>");
  expect(html).toContain(">Status</button>");
  expect(html).toContain("Accepted");
  expect(html).not.toContain("Score");
  const readOnly = renderToStaticMarkup(
    <ProjectRisksView
      onSave={save}
      onTransition={save}
      projectId="project-1"
      readOnly
      records={[record]}
      selectedId={record.id}
    />,
  );
  expect(readOnly).not.toContain(">Create</button>");
  expect(readOnly).not.toContain(">Edit</button>");
  expect(readOnly).not.toContain(">Status</button>");
});

test("Risk creation labels founder text and status editor labels the complete status catalog and rationale", () => {
  const html = renderToStaticMarkup(
    <RiskEditor onCancel={cancel} onSave={save} />,
  );
  for (const label of [
    "Title",
    "Description",
    "Impact",
    "Probability",
    "Response/mitigation",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).not.toContain("risk-life");
  const status = renderToStaticMarkup(
    <RiskEditor
      changingStatus
      onCancel={cancel}
      onSave={save}
      record={record}
    />,
  );
  for (const life of [
    "Open",
    "Mitigating",
    "Occurred",
    "Resolved",
    "Accepted",
  ]) {
    expect(status).toContain(life);
  }
  expect(status).toContain('id="risk-rationale"');
  expect(status).toContain("A known Risk remains recorded when accepted.");
  const acceptedRationale = status.match(rationaleTextareaPattern)?.[0];
  expect(acceptedRationale).toBeDefined();
  expect(acceptedRationale).not.toMatch(disabledAttributePattern);

  const openStatus = renderToStaticMarkup(
    <RiskEditor
      changingStatus
      onCancel={cancel}
      onSave={save}
      record={{ ...record, life: "Open" }}
    />,
  );
  const openRationale = openStatus.match(rationaleTextareaPattern)?.[0];
  expect(openRationale).toBeDefined();
  expect(openRationale).toMatch(disabledAttributePattern);
});
