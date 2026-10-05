import type { RecordTableRecord } from "@cantiara/api/record-discovery";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecordTableView } from "./record-table";

const records: RecordTableRecord[] = [
  {
    createdAt: "2026-01-01T00:00:00.000Z",
    decision: "Ship in June",
    id: "decision-1",
    life: "Valid",
    projectId: "project-1",
    rationale: "Keep the first release focused.",
    revision: 2,
    sourceType: "Decision",
    title: "Choose a launch date",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

const noop = () => undefined;
const noopAsync = async () => undefined;
const decisionLifeSelectPattern =
  /<select[^>]*aria-label="Edit Life for Choose a launch date"[^>]*>[\s\S]*?<\/select>/;

test("renders one type-scoped Table with sortable fields and row filters", () => {
  const markup = renderToStaticMarkup(
    <RecordTableView
      onApplyPaste={noopAsync}
      onProjectChange={noop}
      onRecordTypeChange={noop}
      onSaveCell={noopAsync}
      projectId="project-1"
      projects={[{ id: "project-1", name: "Launch" }]}
      records={records}
      recordType="Decision"
    />,
  );

  expect(markup).toContain('aria-label="Filter rows"');
  expect(markup).toContain(">All Projects<");
  expect(markup).toContain('aria-label="Sort by Title"');
  expect(markup).toContain(">Title<");
  expect(markup).toContain(">Decision<");
  expect(markup).toContain(">Rationale<");
  expect(markup).toContain(">Life<");
  expect(markup).toContain("Choose a launch date");
  expect(markup).toContain('aria-label="Paste rows"');
  expect(markup).not.toContain(">Description<");
  expect(markup).not.toContain(">Document<");
});

test("shows Superseded Decisions as read-only instead of an empty Life cell", () => {
  const supersededDecision = {
    ...records[0],
    life: "Superseded" as const,
  };
  const markup = renderToStaticMarkup(
    <RecordTableView
      onApplyPaste={noopAsync}
      onProjectChange={noop}
      onRecordTypeChange={noop}
      onSaveCell={noopAsync}
      projectId="project-1"
      projects={[{ id: "project-1", name: "Launch" }]}
      records={[supersededDecision]}
      recordType="Decision"
    />,
  );

  const lifeControl = markup.match(decisionLifeSelectPattern)?.[0];
  expect(lifeControl).toContain('disabled=""');
  expect(lifeControl).toContain('value="Superseded" selected=""');
  expect(lifeControl).toContain(">Superseded</option>");
});
