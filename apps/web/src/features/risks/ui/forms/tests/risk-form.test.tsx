import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { RiskRecord } from "../../../lib/risk-form";
import { RiskEditor } from "../risk-form";

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
