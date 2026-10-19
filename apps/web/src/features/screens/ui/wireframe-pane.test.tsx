// @vitest-environment happy-dom

import type { ScreenWireframe } from "@cantiara/api/screens";
import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { createWireframeEditor } from "../engine/editor";
import { stageSizeFor, WireframePane } from "./wireframe-pane";

const FULL_WIDTH_SECTION = /<section[^>]*class="[^"]*\bw-full\b/;
const STAGE_PANE = /<div class="relative[^>]*>/;
const CLIPPING_TRANSFORM = /translate|scale|rotate|style=/;
const save = vi.fn();
const listFetch = vi.fn();

vi.mock("@/env", () => ({
  env: { VITE_SERVER_URL: "https://api.example.org" },
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => ({
  client: { saveScreenWireframe: (input: unknown) => save(input) },
  orpc: {
    projectScreens: {
      queryOptions: () => ({
        queryFn: () => listFetch(),
        queryKey: ["screens"],
      }),
    },
    screenWireframe: {
      queryOptions: () => ({
        queryFn: () => Promise.reject(new Error("Unexpected fetch")),
        queryKey: ["wireframe"],
        staleTime: Number.POSITIVE_INFINITY,
      }),
    },
  },
}));
vi.mock("./wireframe-stage", () => ({
  default: ({ height, width }: { height: number; width: number }) => (
    <div data-height={height} data-testid="stage" data-width={width} />
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.useRealTimers();
  save.mockReset();
  listFetch.mockReset();
});

test("the Wireframe pane is the full-width primary Screen surface with the closed kinds", () => {
  const editor = createWireframeEditor(createEmptyWireframeDocument());
  const html = renderToStaticMarkup(
    <WireframePane editor={editor} liveText={{}} />,
  );

  expect(html).toContain('aria-label="Wireframe"');
  expect(html).toMatch(FULL_WIDTH_SECTION);
  for (const kind of [
    "Button",
    "Input",
    "Card",
    "Table",
    "Navigation",
    "Chart",
  ]) {
    expect(html).toContain(kind);
  }
  // The Stage is not clipped by CSS transforms; it takes the pane's own size.
  const [paneTag] = html.match(STAGE_PANE) ?? [];
  expect(paneTag).toContain("w-full");
  expect(paneTag).not.toMatch(CLIPPING_TRANSFORM);
});

test("the Stage pixel size matches the measured pane", () => {
  expect(stageSizeFor({ height: 612.7, width: 1010.4 })).toEqual({
    height: 612,
    width: 1010,
  });
  expect(stageSizeFor({ height: 0, width: 0 })).toEqual({
    height: 1,
    width: 1,
  });
});

test("a selected linked block offers Detach Link and no other label edit", () => {
  const editor = createWireframeEditor(
    applyWireframeTransaction(
      {
        ...createEmptyWireframeDocument(),
        blocks: [createWireframeBlock("Navigation", "n", { x: 0, y: 0 })],
      },
      [
        {
          blockId: "n",
          definition: {
            content: {
              height: 56,
              kind: "Navigation",
              label: "Header",
              props: { items: ["Home"] },
              width: 560,
            },
            id: "def",
            name: "Header",
            revision: 1,
          },
          type: "linkBlock",
        },
      ],
    ),
  );
  editor.select(["n"]);

  const html = renderToStaticMarkup(
    <WireframePane editor={editor} liveText={{}} />,
  );

  expect(html).toContain("Detach Link");
});

test("a completed gesture saves the Wireframe without refetching the Screen list", async () => {
  vi.useFakeTimers();
  const { default: WireframeSurface } = await import("./wireframe-surface");
  const wireframe: ScreenWireframe = {
    createdAt: "2026-10-01T09:00:00.000Z",
    document: createEmptyWireframeDocument(),
    liveText: {},
    screenId: "screen-1",
    version: 1,
    versionId: "v1",
  };
  save.mockImplementation(async ({ document }) => ({ ...wireframe, document }));
  const cache = new QueryClient();
  cache.setQueryData(["wireframe"], wireframe);
  cache.setQueryData(["screens"], { readOnly: false, screens: [] });
  const invalidate = vi.spyOn(cache, "invalidateQueries");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(() => {
    root.render(
      <QueryClientProvider client={cache}>
        <WireframeSurface
          projectId="project-1"
          readOnly={false}
          screenId="screen-1"
        />
      </QueryClientProvider>,
    );
  });
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === "Button",
  );
  await act(async () => {
    button?.click();
    await vi.advanceTimersByTimeAsync(1000);
  });

  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    document: { blocks: [{ kind: "Button" }] },
    projectId: "project-1",
    screenId: "screen-1",
  });
  expect(invalidate).not.toHaveBeenCalled();
  expect(listFetch).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
