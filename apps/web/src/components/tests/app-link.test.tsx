import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppLink, parseAppHref } from "../app-link";

const rootRoute = createRootRoute({});
const projectsRoute = createRoute({
  component: () => null,
  getParentRoute: () => rootRoute,
  path: "/projects",
  validateSearch: (search: Record<string, unknown>) => search,
});
const projectRoute = createRoute({
  component: () => null,
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
});
const routeTree = rootRoute.addChildren([projectsRoute, projectRoute]);

function render(href: string, initial = "/projects/project-1") {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [initial] }),
    routeTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <AppLink aria-label="Open" className="link" data-testid="x" href={href}>
        Open
      </AppLink>
    </RouterContextProvider>,
  );
}

describe("AppLink", () => {
  test("splits path, search and hash", () => {
    expect(parseAppHref("/projects?savedListId=a%20b#x")).toEqual({
      hash: "x",
      path: "/projects",
      search: { savedListId: "a b" },
    });
  });

  test.each([
    "/projects/project-1#work-w%2F1",
    "/projects/project%2F1#document-doc",
    "/projects",
    "/projects?savedListId=saved-list-1",
    "/personal-wiki#document-d1",
    "/projects/p1",
  ])("keeps href %s", (href) => {
    const html = render(href);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('class="link"');
    expect(html).toContain('aria-label="Open"');
    expect(html).toContain('data-testid="x"');
  });

  test("keeps hash-only href on the current path", () => {
    expect(render("#work-1")).toContain('href="/projects/project-1#work-1"');
  });
});
