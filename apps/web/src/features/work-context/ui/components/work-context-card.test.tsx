import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { RelationView } from "@cantiara/api/relations";
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
  title: "Checkout work",
  type: "Task",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCard(
  statusLabels: readonly WorkStatusLabel[],
  relations: readonly RelationView[] = [],
) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.relations.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }).queryKey,
    [...relations],
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
        <WorkContextCard work={work} workStatusLabels={statusLabels} />
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

  test("keeps an empty why chain neutral until a context section is opened", () => {
    const html = renderCard(workStatusLabels);

    expect(html).not.toContain("Nothing here yet.");
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
});
