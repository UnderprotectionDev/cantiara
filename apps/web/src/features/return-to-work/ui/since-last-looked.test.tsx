import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import SinceLastLooked from "./since-last-looked";

test("Since you last looked shows a semantic group, event time and the current source link", () => {
  const root = createRootRoute({});
  const route = createRoute({
    getParentRoute: () => root,
    path: "/projects/$projectId",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/projects/p#overview"] }),
    routeTree: root.addChildren([route]),
  });
  const markup = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <SinceLastLooked
        changes={{
          lastViewedAt: "2026-10-06T12:00:00.000Z",
          groups: [
            {
              name: "Work",
              events: [
                {
                  id: "event",
                  kind: "Work updated",
                  occurredAt: "2026-10-07T10:00:00.000Z",
                  source: {
                    id: "w",
                    projectId: "p",
                    title: "PAY-1 · Payment retry",
                    sourcePath: "/projects/p#work-w",
                  },
                },
              ],
            },
          ],
        }}
      />
    </RouterContextProvider>,
  );
  expect(markup).toContain("Since you last looked");
  expect(markup).toContain("Work updated");
  expect(markup).toContain("PAY-1 · Payment retry");
  expect(markup).toContain('dateTime="2026-10-07T10:00:00.000Z"');
  expect(markup).toContain('href="/projects/p#work-w"');
  expect(markup).toContain("Open source record");
});
