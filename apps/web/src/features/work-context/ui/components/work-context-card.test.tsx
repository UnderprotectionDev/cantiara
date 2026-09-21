import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { RelationView } from "@cantiara/api/relations";
import type { WorkContextPriorityValues } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import WorkContextCard from "./work-context-card";

const workContextRootRoute = createRootRoute({});
const workContextProjectRoute = createRoute({
  component: () => null,
  getParentRoute: () => workContextRootRoute,
  path: "/projects/$projectId",
});
const workContextRouteTree = workContextRootRoute.addChildren([
  workContextProjectRoute,
]);

const workStatusLabels = [
  { label: "Queued", semantic: "Not Started" },
  { label: "Doing", semantic: "In Progress" },
  { label: "Waiting", semantic: "Blocked" },
  { label: "Done", semantic: "Closed" },
] satisfies readonly WorkStatusLabel[];

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  targetDate: null,
  title: "Checkout work",
  type: "Task",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCard(
  statusLabels: readonly WorkStatusLabel[],
  relations: readonly RelationView[] = [],
  priorityValues?: WorkContextPriorityValues,
) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.workContext.queryOptions({ input: { workId: work.id } }).queryKey,
    {
      priorityValues: priorityValues ?? {},
      relations: [...relations],
    },
  );
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/projects/project-1"],
    }),
    routeTree: workContextRouteTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <WorkContextCard
          priorityValues={priorityValues}
          work={work}
          workStatusLabels={statusLabels}
        />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

describe("Work Context Card initial fields", () => {
  test("shows the Project-configured status label instead of the raw semantic status", () => {
    const html = renderCard(workStatusLabels);

    expect(html).toContain("Doing");
    expect(html).not.toContain("In Progress");
  });

  test("falls back to the protected semantic status without a configured label", () => {
    const html = renderCard([]);

    expect(html).toContain("In Progress");
  });

  test("shows a neutral Priority Foundations empty state without opening context", () => {
    const html = renderCard(workStatusLabels);

    expect(html).toContain("Nothing here yet.");
    expect(html).toContain(">Link</button>");
  });

  test("renders live source names, status, and source links in the why chain", () => {
    const html = renderCard(workStatusLabels, [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        direction: "incoming",
        id: "origin-1",
        inverseLabel: "Derived",
        kind: "Origin",
        label: "Derived",
        revision: 1,
        source: {
          broken: null,
          key: "PAY-2",
          label: "PAY-2",
          originPosition: null,
          projectId: "project-1",
          recordId: "research-1",
          recordType: "Work",
          status: "Closed",
          title: "Checkout interviews",
          workType: "Research",
        },
        target: {
          broken: null,
          key: work.key,
          label: work.key,
          originPosition: null,
          projectId: work.projectId,
          recordId: work.id,
          recordType: "Work",
          status: work.status,
          title: work.title,
          workType: work.type,
        },
      },
    ]);

    expect(html).toContain("Why am I doing this work?");
    expect(html).toContain("Origin Research");
    expect(html).toContain("PAY-2 Checkout interviews");
    expect(html).toContain("Status: Done");
    expect(html).toContain("Open source record");
  });

  test("does not leak inaccessible source content", () => {
    const html = renderCard(workStatusLabels, [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        direction: "incoming",
        id: "decision-1",
        inverseLabel: "Implemented by",
        kind: "Implements",
        label: "Implements",
        revision: 1,
        source: {
          broken: {
            canOpenSourceRecord: false,
            establishedAt: "2026-01-01T00:00:00.000Z",
            reason: "Redacted for security",
          },
          key: null,
          label: null,
          originPosition: null,
          projectId: null,
          recordId: "decision-1",
          recordType: "Decision",
          status: null,
          title: null,
          workType: null,
        },
        target: {
          broken: null,
          key: work.key,
          label: work.key,
          originPosition: null,
          projectId: work.projectId,
          recordId: work.id,
          recordType: "Work",
          status: work.status,
          title: work.title,
          workType: work.type,
        },
      },
    ]);

    expect(html).toContain("Broken — Redacted for security");
    expect(html).not.toContain("secret risk title");
  });

  test("keeps an archived Work source linkable", () => {
    const html = renderCard(workStatusLabels, [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        direction: "incoming",
        id: "archived-origin",
        inverseLabel: "Derived",
        kind: "Origin",
        label: "Derived",
        revision: 1,
        source: {
          broken: {
            canOpenSourceRecord: true,
            establishedAt: "2026-01-02T00:00:00.000Z",
            reason: "Archived",
          },
          key: "PAY-2",
          label: "PAY-2",
          originPosition: null,
          projectId: "project-1",
          recordId: "work-2",
          recordType: "Work",
          status: "Closed",
          title: "Archived checkout work",
          workType: "Research",
        },
        target: {
          broken: null,
          key: work.key,
          label: work.key,
          originPosition: null,
          projectId: work.projectId,
          recordId: work.id,
          recordType: "Work",
          status: work.status,
          title: work.title,
          workType: work.type,
        },
      },
    ]);

    expect(html).toContain("PAY-2 Archived checkout work — Archived");
    expect(html).toContain('href="/projects/project-1#work-work-2"');
  });

  test("renders Priority Foundations without a score and with separate counts", () => {
    const html = renderCard(
      workStatusLabels,
      [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          direction: "incoming",
          id: "feedback-1",
          inverseLabel: "Provides evidence",
          kind: "Evidence",
          label: "Provides evidence",
          revision: 1,
          source: {
            broken: null,
            key: "FB-1",
            label: "FB-1",
            openPath: "/projects/project-1#feedback-feedback-1",
            originPosition: null,
            projectId: "project-1",
            recordId: "feedback-1",
            recordType: "Feedback",
            status: null,
            title: "Make checkout clearer",
            workType: null,
          },
          target: {
            broken: null,
            key: work.key,
            label: work.key,
            originPosition: null,
            projectId: work.projectId,
            recordId: work.id,
            recordType: "Work",
            status: work.status,
            title: work.title,
            workType: work.type,
          },
        },
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          direction: "outgoing",
          id: "feedback-participant-1",
          inverseLabel: "Participant",
          kind: "Participant",
          label: "Participant",
          revision: 1,
          source: {
            broken: null,
            key: "FB-1",
            label: "FB-1",
            originPosition: null,
            projectId: "project-1",
            recordId: "feedback-1",
            recordType: "Feedback",
            status: null,
            title: "Make checkout clearer",
            workType: null,
          },
          target: {
            broken: null,
            key: null,
            label: null,
            originPosition: null,
            projectId: "project-1",
            recordId: "contact-1",
            recordType: "Contact",
            status: null,
            title: "Ada Lovelace",
            workType: null,
          },
        },
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          direction: "outgoing",
          id: "contact-company-1",
          inverseLabel: "Belongs to Company",
          kind: "Belongs to Company",
          label: "Belongs to Company",
          revision: 1,
          source: {
            broken: null,
            key: null,
            label: null,
            originPosition: null,
            projectId: "project-1",
            recordId: "contact-1",
            recordType: "Contact",
            status: null,
            title: "Ada Lovelace",
            workType: null,
          },
          target: {
            broken: null,
            key: null,
            label: null,
            originPosition: null,
            projectId: "project-1",
            recordId: "company-1",
            recordType: "Company",
            status: null,
            title: "Analytical Engines",
            workType: null,
          },
        },
      ],
      {
        effort: "3 days",
        priorityMetrics: [
          {
            id: "evidence-strength",
            name: "Evidence strength",
            projectId: work.projectId,
            value: "High",
          },
        ],
        targetDate: "2026-10-01",
      },
    );

    expect(html).toContain("Priority Foundations");
    expect(html).toContain("Target date");
    expect(html).toContain("2026-10-01");
    expect(html).toContain("Effort");
    expect(html).toContain("3 days");
    expect(html).toContain("Evidence strength");
    expect(html).toContain("Feedback");
    expect(html).toContain("Feedback: 1");
    expect(html).toContain("Unique Contact");
    expect(html).toContain("Unique Company");
    expect(html).toContain('aria-label="Show Feedback source records (1)"');
    expect(html).toContain(
      'aria-label="Show Unique Contact source records (1)"',
    );
    expect(html).toContain('href="/projects/project-1#feedback-feedback-1"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("WSJF");
    expect(html).not.toContain("Score");
  });
});
