import type { RecordTableRecord } from "@cantiara/api/record-discovery";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecordTableView } from "./record-table";

const decisionRecord = {
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
} satisfies RecordTableRecord;

const records: RecordTableRecord[] = [decisionRecord];

const noop = () => undefined;
const noopAsync = async () => undefined;
const decisionLifeSelectPattern =
  /<select[^>]*aria-label="Edit Life for Choose a launch date"[^>]*>[\s\S]*?<\/select>/;
const reachedMilestoneStatusPattern =
  /<select[^>]*aria-label="Edit Status for Reached milestone"[^>]*>[\s\S]*?<\/select>/;
const plannedMilestoneStatusPattern =
  /<select[^>]*aria-label="Edit Status for Planned milestone"[^>]*>[\s\S]*?<\/select>/;

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
  const supersededDecision: RecordTableRecord = {
    ...decisionRecord,
    life: "Superseded",
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

const reachedMilestone = {
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  id: "milestone-reached",
  projectId: "project-1",
  revision: 2,
  sourceType: "Milestone" as const,
  status: "Reached" as const,
  targetDate: null,
  title: "Reached milestone",
  updatedAt: "2026-01-02T00:00:00.000Z",
};
const plannedMilestone = {
  ...reachedMilestone,
  id: "milestone-planned",
  status: "Planned" as const,
  title: "Planned milestone",
};

function renderMilestoneTable(milestoneRecords: RecordTableRecord[]) {
  return renderToStaticMarkup(
    <RecordTableView
      onApplyPaste={noopAsync}
      onProjectChange={noop}
      onRecordTypeChange={noop}
      onSaveCell={noopAsync}
      projectId="project-1"
      projects={[{ id: "project-1", name: "Launch" }]}
      records={milestoneRecords}
      recordType="Milestone"
    />,
  );
}

test("offers only owner-contract Milestone status choices per record", () => {
  const markup = renderMilestoneTable([reachedMilestone, plannedMilestone]);

  const reachedControl = markup.match(reachedMilestoneStatusPattern)?.[0];
  expect(reachedControl).toContain('disabled=""');
  expect(reachedControl).toContain('value="Reached" selected=""');
  expect(reachedControl).not.toContain(">Planned</option>");

  const plannedControl = markup.match(plannedMilestoneStatusPattern)?.[0];
  expect(plannedControl).not.toContain('disabled=""');
  expect(plannedControl).toContain(">Reached</option>");
  expect(plannedControl).toContain(">Abandoned</option>");
});
