import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { orpc } from "@/utils/orpc";
import KanbanList from "./kanban-list";

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-25T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "CAN-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  statusChangedAt: "2026-09-25T08:00:00.000Z",
  targetDate: null,
  title: "Work in progress",
  type: "Task",
  updatedAt: "2026-09-25T09:00:00.000Z",
};

const workStatusLabels = [
  { label: "Not Started", semantic: "Not Started" },
  { label: "In Progress", semantic: "In Progress" },
  { label: "Blocked", semantic: "Blocked" },
  { label: "Closed", semantic: "Closed" },
] satisfies readonly WorkStatusLabel[];

describe("Kanban List", () => {
  test("keeps one source-record action per Work row", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <KanbanList
          focusThreshold={null}
          projectId="project-1"
          workStatusLabels={workStatusLabels}
          works={[work]}
        />
      </QueryClientProvider>,
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/projects/project-1#work-work-1"');
    expect(html).toContain("Open source record");
    expect(html).toContain("CAN-1");
    expect(html).toContain("Work in progress");
  });

  test("shows the shared In Progress count and focus-threshold warning", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.workContext.queryOptions({ input: { workId: work.id } }).queryKey,
      { priorityValues: {}, relations: [] },
    );

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <KanbanList
          focusThreshold={0}
          projectId="project-1"
          workStatusLabels={workStatusLabels}
          works={[work]}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("In Progress count: 1");
    expect(html).toContain("Focus threshold exceeded: 1 / 0");
    expect(html).toContain("Time in status:");
    expect(html).toContain("Open source record");
    expect(html).not.toContain("combobox");
  });
});
