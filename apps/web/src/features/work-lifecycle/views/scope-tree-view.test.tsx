import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import ScopeTreeView from "./scope-tree-view";

const scopeTreeRootRoute = createRootRoute({});
const scopeTreeRoute = createRoute({
  component: () => null,
  getParentRoute: () => scopeTreeRootRoute,
  path: "/projects/$projectId",
});
const scopeTreeRouteTree = scopeTreeRootRoute.addChildren([scopeTreeRoute]);

const scopeTree = {
  features: [
    {
      blockers: [],
      includedWork: [
        {
          blockers: [
            {
              id: "work-blocker",
              key: "PAY-3",
              label: "Wait for provider access",
            },
          ],
          milestones: [{ id: "milestone-1", key: null, label: "Private beta" }],
          work: {
            id: "work-child",
            key: "PAY-2",
            status: "Blocked" as const,
            title: "Verify provider callback",
            type: "Task" as const,
          },
        },
      ],
      milestones: [],
      progress: {
        includedWorkCount: 1,
        statusCounts: {
          Blocked: 0,
          Closed: 0,
          "In Progress": 0,
          "Not Started": 1,
        },
      },
      work: {
        id: "work-feature",
        key: "PAY-1",
        status: "In Progress" as const,
        title: "Checkout Feature",
        type: "Feature" as const,
      },
    },
  ],
  project: { id: "project-1", name: "Payment App" },
};

describe("Scope Tree", () => {
  test("renders a keyboard-walkable, read-only Project to Feature to Work tree", () => {
    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ["/projects/project-1"],
      }),
      routeTree: scopeTreeRouteTree,
    });
    const html = renderToStaticMarkup(
      <RouterContextProvider router={router}>
        <ScopeTreeView scopeTree={scopeTree} />
      </RouterContextProvider>,
    );

    expect(html).toContain("Scope Tree");
    expect(html).toContain("Payment App");
    expect(html).toContain("Checkout Feature");
    expect(html).toContain("Verify provider callback");
    expect(html).toContain("Status");
    expect(html).toContain("In Progress");
    expect(html).toContain("Progress:");
    expect(html).toContain("0 / 1");
    expect(html).toContain("Blocked by");
    expect(html).toContain("Wait for provider access");
    expect(html).toContain("In Milestone");
    expect(html).toContain("Private beta");
    expect(html).toContain('href="/projects/project-1#work-work-feature"');
    expect(html).toContain('href="/projects/project-1#work-work-child"');
    expect(html).toContain('draggable="false"');
    expect(html).toContain('data-scope-tree-read-only="true"');
    expect(html).toContain("open");
    expect(html).not.toContain("Includes");
  });
});
