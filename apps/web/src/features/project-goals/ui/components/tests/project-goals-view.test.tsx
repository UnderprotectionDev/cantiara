// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProjectGoalMembershipView } from "../project-goal-membership-panel";
import { ProjectGoalsView } from "../project-goals-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const onSave = async () => undefined;
const goal = {
  id: "goal/1",
  projectId: "project-1",
  title: "Useful first release",
  description: "Keep context",
  intendedOutcome: "Learn what founders need",
  observedOutcomeLearning: "Small scope helped",
  revision: 2,
  createdAt: "2026-10-07T10:00:00.000Z",
  updatedAt: "2026-10-07T10:00:00.000Z",
};

test("changing Goals while Save is pending keeps the new Goal editor open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const pendingSave = Promise.withResolvers<void>();
  const save = vi.fn(() => pendingSave.promise);
  const second = { ...goal, id: "goal-2", title: "Second goal" };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(selectedId: string, readOnly = false) {
    act(() =>
      root.render(
        <ProjectGoalsView
          goals={[goal, second]}
          onSave={save}
          projectId="project-1"
          readOnly={readOnly}
          selectedId={selectedId}
        />,
      ),
    );
  }
  function edit() {
    const button = [...host.querySelectorAll("button")].find(
      (control) => control.textContent === "Edit Project Goal",
    );
    expect(button).toBeDefined();
    act(() => button?.click());
  }
  try {
    render(goal.id);
    edit();
    const form = host.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(save).toHaveBeenCalledExactlyOnceWith(expect.anything(), goal);

    render(second.id);
    expect(host.querySelector("form")).toBeNull();
    edit();
    await act(async () => pendingSave.resolve());
    expect(host.querySelector("form input")?.getAttribute("value")).toBe(
      second.title,
    );

    render(second.id, true);
    expect(host.querySelector("form")).toBeNull();
    render(second.id);
    expect(host.querySelector("form")).toBeNull();
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
describe("Project Goals visible record seam", () => {
  test("shows founder outcomes without progress, health, lifecycle, or Key Results", () => {
    const html = renderToStaticMarkup(
      <ProjectGoalsView
        goals={[goal]}
        onSave={onSave}
        projectId="project-1"
        readOnly={false}
        selectedId={goal.id}
      />,
    );
    for (const text of [
      "Project Goal",
      "Intended outcome",
      "Observed outcome / learning",
      goal.title,
      goal.description,
      goal.intendedOutcome,
      goal.observedOutcomeLearning,
    ]) {
      expect(html).toContain(text);
    }
    for (const text of ["progress", "Key Result", "health", "Reached", "%"]) {
      expect(html).not.toContain(text);
    }
  });
  test("starts empty and offers creation without inventing a Goal", () => {
    const html = renderToStaticMarkup(
      <ProjectGoalsView
        goals={[]}
        onSave={onSave}
        projectId="project-1"
        readOnly={false}
      />,
    );
    expect(html).toContain("No Project Goals recorded yet.");
    expect(html).toContain("New Project Goal");
    expect(html).not.toContain("Useful first release");
  });
  test("keeps archived Goals readable with no editing controls", () => {
    const html = renderToStaticMarkup(
      <ProjectGoalsView
        goals={[goal]}
        onSave={onSave}
        projectId="project-1"
        readOnly
        selectedId={goal.id}
      />,
    );
    expect(html).toContain(goal.observedOutcomeLearning);
    expect(html).not.toContain("Edit Project Goal");
    expect(html).not.toContain("New Project Goal");
  });
});

test("Goal detail shows source-linked neutral status counts and historical members", () => {
  const source = {
    recordId: "work-1",
    recordType: "Work" as const,
    title: "Find the problem",
    status: "In Progress",
    workType: "Research",
    openPath: "/projects/project-1#work-work-1",
    unavailable: false,
  };
  const rootRoute = createRootRoute({});
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/projects/$projectId",
  });
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/projects/project-1#goals"],
    }),
    routeTree: rootRoute.addChildren([projectRoute]),
  });
  const html = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ProjectGoalMembershipView
        detail={{
          relations: [
            {
              id: "membership",
              kind: "Contributes to Goal",
              revision: 1,
              attached: true,
              source,
            },
            {
              id: "deleted",
              kind: "Contributes to Goal",
              revision: 1,
              attached: true,
              source: {
                ...source,
                recordId: "deleted",
                title: null,
                openPath: null,
                unavailable: true,
              },
            },
          ],
          candidates: [source],
          statusMix: [
            { recordType: "Research", status: "In Progress", count: 1 },
          ],
          openQuestionsAndRisks: [],
          readOnly: false,
        }}
        onSetRelation={onSave}
        projectId="project-1"
      />
    </RouterContextProvider>,
  );
  for (const text of [
    "Contributes to Goal",
    "Find the problem",
    "Research",
    "In Progress",
    "Unavailable source record",
    source.openPath,
  ]) {
    expect(html).toContain(text);
  }
  for (const text of ["%", "health", "success", "completion"]) {
    expect(html).not.toContain(text);
  }
});
