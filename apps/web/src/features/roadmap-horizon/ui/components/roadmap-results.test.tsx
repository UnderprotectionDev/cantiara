import type {
  RoadmapBlocker,
  RoadmapView,
} from "@cantiara/api/roadmap-horizon";
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

import { RoadmapResults } from "./roadmap-results";

const OPEN_DETAILS = /<details[^>]*open=/;

const rootRoute = createRootRoute({});
const projectRoute = createRoute({
  component: () => null,
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const routeTree = rootRoute.addChildren([projectRoute]);

const candidate = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-27T09:00:00.000Z",
  description: "Validate the payment provider's access requirements.",
  effort: null,
  featureHealthHistory: [],
  id: "work-blocked-1",
  key: "RMP-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  statusChangedAt: "2026-09-27T09:00:00.000Z",
  targetDate: null,
  title: "Confirm provider requirements",
  type: "Task",
  updatedAt: "2026-09-27T09:00:00.000Z",
} satisfies WorkProfile;

const blocker = {
  archivedAt: null,
  id: "work-blocker-1",
  key: "RMP-2",
  projectId: "project-1",
  status: "Blocked",
  title: "Get provider access",
  type: "Task",
} satisfies RoadmapBlocker["blocker"];

const view: RoadmapView = {
  groupBy: "Type",
  horizons: [],
  id: "view-1",
  markBy: "Horizon",
  name: "Tasks",
  projectId: "project-1",
  revision: 1,
  types: ["Task"],
};

function renderResults(presentationMode = false) {
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/projects/project-1"],
    }),
    routeTree,
  });
  const blockers: RoadmapBlocker[] = [{ blockedWorkId: candidate.id, blocker }];
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <RouterContextProvider router={router}>
        <RoadmapResults
          blockers={blockers}
          origins={[]}
          presentationMode={presentationMode}
          view={view}
          works={[candidate]}
        />
      </RouterContextProvider>
    </QueryClientProvider>,
  );
}

describe("Roadmap Horizon presentation", () => {
  test("shows filtered unplanned Work in a collapsed live section and opens both blocker records", () => {
    const html = renderResults();

    expect(html).toContain("Unplanned candidates");
    expect(html).toContain("(1)");
    expect(html).not.toMatch(OPEN_DETAILS);
    expect(html).toContain("Place on plan");
    expect(html).toContain("Review Later");
    expect(html).toContain("Blocked Work");
    expect(html).toContain("Blocked by");
    expect(html).toContain("Get provider access");
    expect(html).toContain('href="/projects/project-1#work-work-blocked-1"');
    expect(html).toContain('href="/projects/project-1#work-work-blocker-1"');
    expect(html).not.toContain("Parked");
  });

  test("hides editing and opens source records as read-only details in Presentation Mode", () => {
    const html = renderResults(true);

    expect(html).toContain("Open source record");
    expect(html).toContain(
      'aria-label="Open source record: RMP-2 Get provider access"',
    );
    expect(html).not.toContain("Place on plan");
    expect(html).not.toContain("Place on horizon");
    expect(html).not.toContain('href="/projects/project-1');
  });
});
