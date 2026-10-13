import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProjectGoalMembershipView } from "./project-goal-membership-view";
import { ProjectGoalEditor, ProjectGoalsView } from "./project-goals-view";

const onSave = async () => undefined;
const onCancel = () => undefined;
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
  test("provides labelled required fields and optional outcome fields", () => {
    const html = renderToStaticMarkup(
      <ProjectGoalEditor onCancel={onCancel} onSave={onSave} />,
    );
    expect(html).toContain('for="project-goal-title"');
    expect(html).toContain('for="project-goal-description"');
    expect(html).toContain('for="project-goal-intendedOutcome"');
    expect(html).toContain('for="project-goal-observedOutcomeLearning"');
    expect(html.match(/required=""/g)).toHaveLength(2);
    expect(html).toContain("Cancel");
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
