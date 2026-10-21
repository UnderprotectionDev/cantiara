// @vitest-environment happy-dom
import type { TechnicalDiagramViewport } from "@cantiara/api/technical-diagram-viewport";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());

vi.mock("@/utils/orpc", () => ({
  client: { saveTechnicalDiagramViewport: save },
  orpc: {
    technicalDiagramViewport: {
      queryOptions: ({ input }: { input: unknown }) => ({
        queryFn: () => Promise.resolve(null),
        queryKey: ["technicalDiagramViewport", input],
      }),
    },
  },
}));

import { usePersonalTechnicalDiagramView } from "./use-personal-technical-diagram-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const view = (x: number): TechnicalDiagramViewport =>
  ({ x, y: 0, zoom: 1 }) as unknown as TechnicalDiagramViewport;

let container: HTMLDivElement;
let root: Root;
let schedule: (view: TechnicalDiagramViewport) => void;

function Probe({ diagramId }: { diagramId: string }) {
  ({ schedule } = usePersonalTechnicalDiagramView(diagramId, undefined));
  return null;
}

const render = (diagramId: string) =>
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe diagramId={diagramId} />
      </QueryClientProvider>,
    ),
  );

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
  save.mockResolvedValue(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("personal Technical Diagram view save", () => {
  test("saves only the last viewport after the debounce wait", async () => {
    render("diagram-1");
    act(() => {
      schedule(view(1));
      schedule(view(2));
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      diagramId: "diagram-1",
      viewport: view(2),
    });
  });

  test("flushes the pending viewport when leaving the canvas", async () => {
    render("diagram-1");
    act(() => schedule(view(3)));
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      diagramId: "diagram-1",
      viewport: view(3),
    });
    root = createRoot(container);
  });

  test("flushes the old diagram's position when switching diagrams", async () => {
    render("diagram-1");
    act(() => schedule(view(4)));
    await act(async () => {
      render("diagram-2");
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      diagramId: "diagram-1",
      viewport: view(4),
    });
  });
});
