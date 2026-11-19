// @vitest-environment happy-dom
import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());

vi.mock("@/utils/orpc", () => ({
  client: { saveProjectWallViewport: save },
  orpc: {
    projectWallViewport: {
      queryOptions: ({ input }: { input: unknown }) => ({
        queryFn: () => Promise.resolve(null),
        queryKey: ["projectWallViewport", input],
      }),
    },
  },
}));

import { usePersonalProjectWallView } from "../use-personal-project-wall-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let queries: QueryClient;
let schedule: (view: ProjectWallViewport) => void;

const first: ProjectWallViewport = {
  center: { x: 100, y: 200 },
  collapsed: [],
  zoom: 1,
};
const last: ProjectWallViewport = {
  center: { x: 300, y: 400 },
  collapsed: ["group-1"],
  zoom: 2,
};

function Probe({ wallId }: { wallId: string | null }) {
  ({ schedule } = usePersonalProjectWallView("project-1", wallId));
  return null;
}

function render(wallId: string | null) {
  act(() => {
    root.render(
      <QueryClientProvider client={queries}>
        <Probe wallId={wallId} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
  save.mockResolvedValue(null);
  queries = new QueryClient();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  queries.clear();
  host.remove();
  vi.useRealTimers();
});

test("saves the last personal Project Wall view once after movement settles", async () => {
  render("wall-1");
  act(() => {
    schedule(first);
    schedule(last);
  });
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(save).toHaveBeenCalledExactlyOnceWith({
    projectId: "project-1",
    viewport: last,
    wallId: "wall-1",
  });
});

test("switching walls saves the pending position to the wall that was left", async () => {
  render("wall-1");
  act(() => schedule(last));
  await act(async () => render("wall-2"));
  expect(save).toHaveBeenCalledExactlyOnceWith({
    projectId: "project-1",
    viewport: last,
    wallId: "wall-1",
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test("leaving the wall flushes its pending personal view without a later duplicate", async () => {
  render("wall-1");
  act(() => schedule(last));
  await act(async () => root.unmount());
  expect(save).toHaveBeenCalledExactlyOnceWith({
    projectId: "project-1",
    viewport: last,
    wallId: "wall-1",
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  root = createRoot(host);
});

test("no personal view is saved without an active wall", async () => {
  render(null);
  act(() => schedule(last));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(save).not.toHaveBeenCalled();
});
