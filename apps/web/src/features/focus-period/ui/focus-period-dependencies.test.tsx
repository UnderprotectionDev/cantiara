import type {
  RelationEndpointView,
  WorkDependenciesProjection,
} from "@cantiara/api/relations";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FocusPeriodDependencies } from "./focus-period-dependencies";

const OPEN_DETAILS = /<details[^>]*open=/;
const rootRoute = createRootRoute({});
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const routeTree = rootRoute.addChildren([projectRoute]);

const blocker: RelationEndpointView = {
  broken: null,
  key: "ALPHA-1",
  label: "Prepare access",
  originPosition: null,
  projectId: "alpha",
  recordId: "work-1",
  recordType: "Work",
  status: "Blocked",
  title: "Prepare access",
  workType: "Task",
};
const blocked: RelationEndpointView = {
  ...blocker,
  key: "BETA-1",
  label: "Ship release",
  projectId: "beta",
  recordId: "work-2",
  title: "Ship release",
};
const active = {
  blocked,
  blocker,
  relationId: "active",
  status: "Active",
} as const;
const resolved = {
  blocked: blocker,
  blocker: blocked,
  relationId: "resolved",
  status: "Resolved",
} as const;

function renderDependencies(dependencies: WorkDependenciesProjection) {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/projects/alpha"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <FocusPeriodDependencies dependencies={dependencies} />
    </RouterContextProvider>,
  );
}

describe("Focus Period read-only Dependencies", () => {
  test("starts collapsed and explains direction, both statuses, and scoped cycles without write controls", () => {
    const html = renderDependencies({
      cycles: [{ edges: [active, resolved], records: [blocker, blocked] }],
      edges: [active, resolved],
      nodes: [blocker, blocked],
    });

    expect(html).toContain("<summary");
    expect(html).not.toMatch(OPEN_DETAILS);
    expect(html).toContain("Dependencies</summary>");
    expect(html).toContain(" blocks ");
    expect(html).toContain("Active");
    expect(html).toContain("Resolved");
    expect(html).toContain("Part of a dependency cycle");
    expect(html).toContain("Open source record: ALPHA-1 Prepare access");
    expect(html).toContain('href="/projects/alpha#work-work-1"');
    expect(html).toContain('href="/projects/beta#work-work-2"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<form");
  });

  test("shows the empty scope without inventing nodes or relations", () => {
    const html = renderDependencies({ cycles: [], edges: [], nodes: [] });

    expect(html).toContain("No dependencies in this Focus Period.");
    expect(html).not.toContain("Open source record");
    expect(html).not.toContain("Part of a dependency cycle");
    expect(html).not.toMatch(OPEN_DETAILS);
  });

  test("does not mark an acyclic wait as a cycle or mutate its projection", () => {
    const dependencies: WorkDependenciesProjection = {
      cycles: [],
      edges: [active],
      nodes: [blocker, blocked],
    };
    const before = structuredClone(dependencies);
    const html = renderDependencies(dependencies);

    expect(html).toContain("Active");
    expect(html).not.toContain("Part of a dependency cycle");
    expect(dependencies).toEqual(before);
  });
});
