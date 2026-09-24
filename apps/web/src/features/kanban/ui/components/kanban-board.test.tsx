import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile, WorkStatus } from "@cantiara/api/work-lifecycle";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import KanbanBoard from "./kanban-board";

const workForStatus = (status: WorkStatus, number: number): WorkProfile => ({
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: status === "Closed" ? "Completed" : null,
  createdAt: "2026-09-25T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: `work-${number}`,
  key: `CAN-${number}`,
  number,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status,
  targetDate: null,
  title: `Work ${number}`,
  type: "Task",
  updatedAt: "2026-09-25T09:00:00.000Z",
});

const workStatusLabels = [
  { label: "Not Started", semantic: "Not Started" },
  { label: "In Progress", semantic: "In Progress" },
  { label: "Blocked", semantic: "Blocked" },
  { label: "Closed", semantic: "Closed" },
] satisfies readonly WorkStatusLabel[];
const onStatusAction = (_work: WorkProfile, _status: WorkStatus) => undefined;

describe("Kanban Board", () => {
  test("shows the four protected status columns and opens source Work records", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        disabled={false}
        error={null}
        onStatusAction={onStatusAction}
        projectId="project-1"
        workStatusLabels={workStatusLabels}
        works={[
          workForStatus("Not Started", 1),
          workForStatus("In Progress", 2),
          workForStatus("Blocked", 3),
          workForStatus("Closed", 4),
        ]}
      />,
    );

    expect(html.match(/data-kanban-column=/g)).toHaveLength(4);
    expect(html).toContain("Board");
    expect(html).toContain("Kanban");
    expect(html).toContain("Not Started");
    expect(html).toContain("In Progress");
    expect(html).toContain("Blocked");
    expect(html).toContain("Closed");
    expect(html).toContain("CAN-4");
    expect(html).toContain("Work 4");
    expect(html).toContain("Completed");
    expect(html).toContain('href="/projects/project-1#work-work-1"');
    expect(html).toContain("Open source record");
    expect(html).not.toContain("Sprint");
    expect(html).not.toContain("Archived Work");
  });

  test("offers a status control and a drag handle for each source Work", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        disabled={false}
        error={null}
        onStatusAction={onStatusAction}
        projectId="project-1"
        workStatusLabels={workStatusLabels}
        works={[workForStatus("In Progress", 1)]}
      />,
    );

    expect(html).toContain('aria-label="Status for CAN-1"');
    expect(html).toContain('aria-label="Move CAN-1"');
    expect(html).toContain('aria-label="In Progress Work"');
  });
});
