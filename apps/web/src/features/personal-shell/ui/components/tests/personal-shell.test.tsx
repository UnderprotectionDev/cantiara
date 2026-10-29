// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: Test render callbacks are inline.
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import PersonalShell from "../personal-shell";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const rootRoute = createRootRoute({});
const routeTree = rootRoute.addChildren(
  [
    "/projects",
    "/daily-focus",
    "/favorites",
    "/notifications",
    "/look-again",
  ].map((path) =>
    createRoute({
      component: () => null,
      getParentRoute: () => rootRoute,
      path,
    }),
  ),
);

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  localStorage.clear();
  sessionStorage.clear();
});

function mount() {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/projects"] }),
    routeTree,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <RouterContextProvider router={router}>
        <main id="source-view">Source view</main>
        <PersonalShell
          renderSurface={(surface) => <p>{`Surface: ${surface}`}</p>}
        />
      </RouterContextProvider>,
    );
  });
  return router;
}

function button(name: string) {
  return [...document.querySelectorAll<HTMLElement>("button")].find(
    (element) => element.textContent === name,
  );
}

function tab(name: string) {
  return [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (element) => element.textContent === name,
  );
}

describe("Personal Shell", () => {
  test("starts closed and opens as a temporary panel over the current route", async () => {
    const router = mount();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => button("Personal")?.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Surface: Daily Focus");
    expect(document.getElementById("source-view")?.textContent).toBe(
      "Source view",
    );
    expect(router.state.location.pathname).toBe("/projects");
  });

  test("switches the four surfaces and points Open full page at the selected one", async () => {
    mount();
    await act(async () => button("Personal")?.click());
    const expected = {
      "Daily Focus": "/daily-focus",
      Favorites: "/favorites",
      "Look again": "/look-again",
      "Notification Center": "/notifications",
    };
    for (const [name, path] of Object.entries(expected)) {
      act(() => tab(name)?.click());
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain(`Surface: ${name}`);
      const link = [...(dialog?.querySelectorAll("a") ?? [])].find(
        (anchor) => anchor.textContent === "Open full page",
      );
      expect(link?.getAttribute("href")).toBe(path);
    }
  });

  test("writes no browser storage and does not restore the surface in a new session", async () => {
    mount();
    await act(async () => button("Personal")?.click());
    await act(async () => tab("Favorites")?.click());
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    act(() => root?.unmount());
    host?.remove();
    mount();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => button("Personal")?.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Surface: Daily Focus",
    );
  });
});
