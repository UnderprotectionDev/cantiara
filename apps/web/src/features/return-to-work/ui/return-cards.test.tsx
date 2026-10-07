import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ReturnCards from "./return-cards";

const rootRoute = createRootRoute({});
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const routeTree = rootRoute.addChildren([projectRoute]);

test("Return to Work shows a current source, reason and source link with its active hint", () => {
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/projects/project-1#overview"],
    }),
    routeTree,
  });
  const markup = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ReturnCards
        cards={[
          {
            id: "work-1",
            projectId: "project-1",
            recordType: "Work",
            title: "PAY-1 · Investigate payments",
            sourcePath: "/projects/project-1#work-work-1",
            revision: 2,
            updatedAt: "2026-10-07T10:00:00.000Z",
            targetDate: "2026-10-10",
            reasons: ["Upcoming date"],
            nextConcreteStep: "Ask the customer",
            nextConcreteStepUpdatedAt: "2026-10-07T09:00:00.000Z",
          },
        ]}
      />
    </RouterContextProvider>,
  );
  expect(markup).toContain("PAY-1 · Investigate payments");
  expect(markup).toContain("Upcoming date");
  expect(markup).toContain('href="/projects/project-1#work-work-1"');
  expect(markup).toContain("Open source record");
  expect(markup).toContain("Next concrete step");
  expect(markup).toContain("Ask the customer");
});
