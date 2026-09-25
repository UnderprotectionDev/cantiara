import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile, WorkStatus } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { orpc } from "@/utils/orpc";
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
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status,
  statusChangedAt: "2026-09-25T08:00:00.000Z",
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

function renderBoard(
  works: readonly WorkProfile[],
  configuration: {
    focusThreshold: number | null;
    softWipLimits: Record<WorkStatus, number | null>;
  } = {
    focusThreshold: null,
    softWipLimits: {
      Blocked: null,
      Closed: null,
      "In Progress": null,
      "Not Started": null,
    },
  },
) {
  const queryClient = new QueryClient();
  for (const work of works) {
    queryClient.setQueryData(
      orpc.workContext.queryOptions({ input: { workId: work.id } }).queryKey,
      { priorityValues: {}, relations: [] },
    );
  }

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <KanbanBoard
        disabled={false}
        error={null}
        focusThreshold={configuration.focusThreshold}
        onStatusAction={onStatusAction}
        projectId="project-1"
        softWipLimits={configuration.softWipLimits}
        workStatusLabels={workStatusLabels}
        works={works}
      />
    </QueryClientProvider>,
  );
}

async function renderBoardWithFailedWorkContext(work: WorkProfile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryOnMount: false } },
  });
  const options = orpc.workContext.queryOptions({
    input: { workId: work.id },
  });
  await queryClient
    .fetchQuery({
      ...options,
      queryFn: () => Promise.reject(new Error("Network unavailable")),
      retry: false,
    })
    .catch(() => undefined);

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <KanbanBoard
        disabled={false}
        error={null}
        focusThreshold={null}
        onStatusAction={onStatusAction}
        projectId="project-1"
        softWipLimits={{
          Blocked: null,
          Closed: null,
          "In Progress": null,
          "Not Started": null,
        }}
        workStatusLabels={workStatusLabels}
        works={[work]}
      />
    </QueryClientProvider>,
  );
}

describe("Kanban Board", () => {
  test("shows the four protected status columns and opens source Work records", () => {
    const html = renderBoard([
      workForStatus("Not Started", 1),
      workForStatus("In Progress", 2),
      workForStatus("Blocked", 3),
      workForStatus("Closed", 4),
    ]);

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
    const html = renderBoard([workForStatus("In Progress", 1)]);

    expect(html).toContain('aria-label="Status for CAN-1"');
    expect(html).toContain('aria-label="Move CAN-1"');
    expect(html).toContain('aria-label="In Progress Work"');
  });

  test("shows active Work count, elapsed time, and non-blocking threshold signals", () => {
    const works = [
      workForStatus("In Progress", 1),
      workForStatus("In Progress", 2),
    ];
    const html = renderBoard(works, {
      focusThreshold: 1,
      softWipLimits: {
        Blocked: null,
        Closed: null,
        "In Progress": 1,
        "Not Started": null,
      },
    });

    expect(html).toContain("In Progress count: 2");
    expect(html).toContain("Time in status:");
    expect(html).toContain("2 / 1");
    expect(html).toContain("Over limit");
    expect(html).toContain("Focus threshold exceeded");
    expect(html).toContain('aria-label="Move CAN-1"');
  });

  test("renders priority and active Work blocker summaries", () => {
    const work = workForStatus("Blocked", 1);
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.workContext.queryOptions({ input: { workId: work.id } }).queryKey,
      {
        priorityValues: {
          priorityMetrics: [
            {
              id: "metric-1",
              name: "Customer impact",
              projectId: "project-1",
              value: "High",
            },
          ],
        },
        relations: [
          {
            blockingHistory: [],
            blockingResolutionNote: null,
            blockingResolvedAt: null,
            blockingStatus: "Active",
            createdAt: "2026-09-25T09:00:00.000Z",
            direction: "incoming",
            id: "relation-1",
            inverseLabel: "Blocked by",
            kind: "Blocks",
            label: "Blocks",
            revision: 1,
            source: {
              broken: null,
              key: "CAN-2",
              label: null,
              originPosition: null,
              projectId: "project-1",
              recordId: "work-2",
              recordType: "Work",
              status: "In Progress",
              title: "Resolve provider access",
              workType: "Task",
            },
            target: {
              broken: null,
              key: work.key,
              label: null,
              originPosition: null,
              projectId: "project-1",
              recordId: work.id,
              recordType: "Work",
              status: work.status,
              title: work.title,
              workType: work.type,
            },
          },
        ],
      },
    );
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <KanbanBoard
          disabled={false}
          error={null}
          focusThreshold={null}
          onStatusAction={onStatusAction}
          projectId="project-1"
          softWipLimits={{
            Blocked: null,
            Closed: null,
            "In Progress": null,
            "Not Started": null,
          }}
          workStatusLabels={workStatusLabels}
          works={[work]}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Priority:");
    expect(html).toContain("Customer impact: High");
    expect(html).toContain("Blocked by: CAN-2 Resolve provider access");
  });

  test("shows an error when card summary details could not load", async () => {
    const html = await renderBoardWithFailedWorkContext(
      workForStatus("Blocked", 1),
    );

    expect(html).toContain(
      "Priority and related record details could not be loaded.",
    );
    expect(html).toContain('role="alert"');
  });
});
