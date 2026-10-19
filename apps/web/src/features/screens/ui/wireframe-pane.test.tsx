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
const STAGE_PANE = /<div[^>]*class="[^"]*\brelative\b[^>]*>/;
const CLIPPING_TRANSFORM = /translate|scale|rotate|style=/;
const save = vi.fn();
const listFetch = vi.fn();
const saveViewport = vi.fn();
const viewportFetch = vi.fn();
const wireframeFetch = vi.fn();

vi.mock("@/env", () => ({
  env: { VITE_SERVER_URL: "https://api.example.org" },
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => ({
  client: {
    saveScreenViewport: (input: unknown) => saveViewport(input),
    saveScreenWireframe: (input: unknown) => save(input),
  },
  orpc: {
    projectScreens: {
      queryOptions: () => ({
        queryFn: () => listFetch(),
        queryKey: ["screens"],
      }),
    },
    screenViewport: {
      queryOptions: () => ({
        queryFn: () => viewportFetch(),
        queryKey: ["viewport"],
      }),
    },
    screenWireframe: {
      queryOptions: () => ({
        queryFn: () => wireframeFetch(),
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
  saveViewport.mockReset();
  viewportFetch.mockReset();
  wireframeFetch.mockReset();
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
  cache.setQueryData(["viewport"], { viewport: null });
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
  // A geometry write does not refetch (or write) the personal viewport.
  expect(viewportFetch).not.toHaveBeenCalled();
  expect(saveViewport).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  return {
    container,
    async render() {
      await act(() => {
        root.render(element);
      });
    },
    unmount: () => act(async () => root.unmount()),
  };
}

function buttonNamed(container: HTMLElement, name: string) {
  return [...container.querySelectorAll("button")].find((element) =>
    element.textContent?.trim().startsWith(name),
  );
}

function threeBlocks() {
  return {
    ...createEmptyWireframeDocument(),
    blocks: [
      createWireframeBlock("Card", "card-1", { x: 0, y: 0 }),
      createWireframeBlock("Button", "button-1", { x: 400, y: 0 }),
      createWireframeBlock("Button", "button-2", { x: 400, y: 100 }),
    ],
  };
}

const convertActions = {
  confirm: vi.fn(),
  preview: vi.fn(),
};

test("Fit View returns to the neutral view and reports only the viewport", async () => {
  const editor = createWireframeEditor(createEmptyWireframeDocument());
  const onChange = vi.fn();
  const view = mount(
    <WireframePane
      editor={editor}
      liveText={{}}
      viewport={{
        onChange,
        saved: { centerX: 5, centerY: 5, collapsedGroups: [], zoom: 2 },
      }}
    />,
  );
  await view.render();

  await act(() => {
    buttonNamed(view.container, "Fit View")?.click();
  });

  expect(onChange).toHaveBeenCalledWith({
    centerX: 640,
    centerY: 400,
    collapsedGroups: [],
    zoom: 1,
  });
  expect(editor.getState().canUndo).toBe(false);
  await view.unmount();
});

test("the canvas pans, zooms, selects, moves and aligns from the keyboard", async () => {
  const editor = createWireframeEditor(threeBlocks());
  const onChange = vi.fn();
  const view = mount(
    <WireframePane
      editor={editor}
      liveText={{}}
      viewport={{ onChange, saved: null }}
    />,
  );
  await view.render();
  const canvas = view.container.querySelector<HTMLElement>(
    '[aria-roledescription="canvas"]',
  );
  expect(canvas?.tabIndex).toBe(0);
  const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => {
      canvas?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key, ...init }),
      );
    });

  await press("ArrowRight");
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ centerX: 720, centerY: 400 }),
  );
  await press("+");
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ zoom: 1.25 }),
  );
  await press("0");
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ centerX: 640, zoom: 1 }),
  );
  const viewCalls = onChange.mock.calls.length;

  await press("]");
  expect(editor.getState().selection).toEqual(["card-1"]);
  await press("ArrowDown", { shiftKey: true });
  expect(editor.getState().document.blocks[0]?.y).toBe(8);
  editor.select(["button-1", "button-2"]);
  await press("ArrowLeft", { altKey: true });
  const [, first, second] = editor.getState().document.blocks;
  expect(first?.x).toBe(second?.x);
  // Moving and aligning are document gestures, never viewport writes.
  expect(onChange.mock.calls.length).toBe(viewCalls);
  await view.unmount();
});

test("the outline creates, selects, reorders, groups, inspects and removes without a pointer", async () => {
  const editor = createWireframeEditor(threeBlocks());
  const onChange = vi.fn();
  const view = mount(
    <WireframePane
      editor={editor}
      liveText={{}}
      viewport={{ onChange, saved: null }}
    />,
  );
  await view.render();

  // Create: the toolbar buttons are ordinary focusable buttons.
  await act(() => {
    buttonNamed(view.container, "Navigation")?.click();
  });
  const created = editor.getState().document.blocks.at(-1);
  expect(created?.kind).toBe("Navigation");
  expect(editor.getState().selection).toEqual([created?.id]);

  await act(() => {
    buttonNamed(view.container, "Button: Button")?.click();
  });
  expect(editor.getState().selection).toEqual(["button-1"]);
  expect(view.container.querySelector('[aria-label="Inspect block"]')).not.toBe(
    null,
  );
  await act(() => {
    buttonNamed(view.container, "Move down")?.click();
  });
  expect(
    editor
      .getState()
      .document.blocks.map(({ id }) => id)
      .slice(0, 3),
  ).toEqual(["card-1", "button-2", "button-1"]);

  // Group: collapsing is view-local and reported as part of the viewport.
  await act(() => {
    buttonNamed(view.container, "Collapse Button group")?.click();
  });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ collapsedGroups: ["Button"] }),
  );
  expect(buttonNamed(view.container, "Button: Button")).toBeUndefined();
  expect(editor.getState().document.blocks).toHaveLength(4);

  await act(() => {
    buttonNamed(view.container, "Expand Button group")?.click();
  });
  await act(() => {
    buttonNamed(view.container, "Remove Block")?.click();
  });
  expect(editor.getState().document.blocks).toHaveLength(3);
  await view.unmount();
});

test("Convert and Bind mounts on the selected outline row only", async () => {
  const editor = createWireframeEditor(threeBlocks());
  const view = mount(
    <WireframePane convert={convertActions} editor={editor} liveText={{}} />,
  );
  await view.render();
  const converters = () =>
    [...view.container.querySelectorAll("button")].filter(
      (element) => element.textContent?.trim() === "Convert and Bind",
    );
  expect(converters()).toHaveLength(0);

  await act(() => {
    buttonNamed(view.container, "Card:")?.click();
  });
  expect(converters()).toHaveLength(1);
  const [only] = converters();
  expect(only?.closest("li")?.textContent).toContain("Card:");

  await act(() => {
    editor.select(["card-1", "button-1"]);
  });
  expect(converters()).toHaveLength(0);
  await view.unmount();
});

test("Open Source Record opens the record a block reads from", async () => {
  const live = {
    height: 120,
    id: "live-1",
    kind: "Live Card",
    label: "Decision",
    props: { recordId: "decision-9", recordType: "Decision" },
    seed: 1,
    width: 280,
    x: 0,
    y: 0,
  };
  const editor = createWireframeEditor({
    ...createEmptyWireframeDocument(),
    blocks: [
      live as never,
      createWireframeBlock("Card", "plain", { x: 400, y: 0 }),
    ],
  });
  const onOpenSource = vi.fn();
  const view = mount(
    <WireframePane editor={editor} liveText={{}} onOpenSource={onOpenSource} />,
  );
  await view.render();

  await act(() => {
    buttonNamed(view.container, "Card: Card")?.click();
  });
  expect(buttonNamed(view.container, "Open Source Record")).toBeUndefined();
  await act(() => {
    buttonNamed(view.container, "Live Card:")?.click();
  });
  await act(() => {
    buttonNamed(view.container, "Open Source Record")?.click();
  });

  expect(onOpenSource).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "record",
      recordId: "decision-9",
      recordType: "Decision",
    }),
  );
  await view.unmount();
});

test("a restored viewport brings back no selection, inspector or edit state", async () => {
  const editor = createWireframeEditor(threeBlocks());
  const view = mount(
    <WireframePane
      convert={convertActions}
      editor={editor}
      liveText={{}}
      viewport={{
        onChange: vi.fn(),
        saved: { centerX: 100, centerY: 100, collapsedGroups: [], zoom: 1 },
      }}
    />,
  );
  await view.render();

  expect(editor.getState().selection).toEqual([]);
  expect(view.container.querySelector('[aria-pressed="true"]')).toBe(null);
  expect(view.container.querySelector('[aria-label="Inspect block"]')).toBe(
    null,
  );
  expect(view.container.querySelector("textarea, input[type=text]")).toBe(null);
  await view.unmount();
});

test("a viewport change saves only the viewport, never the Wireframe, list or document", async () => {
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
  saveViewport.mockResolvedValue({ viewport: null });
  const cache = new QueryClient();
  cache.setQueryData(["wireframe"], wireframe);
  cache.setQueryData(["viewport"], { viewport: null });
  cache.setQueryData(["screens"], { readOnly: false, screens: [] });
  const invalidate = vi.spyOn(cache, "invalidateQueries");
  const view = mount(
    <QueryClientProvider client={cache}>
      <WireframeSurface
        projectId="project-1"
        readOnly={false}
        screenId="screen-1"
      />
    </QueryClientProvider>,
  );
  await view.render();

  await act(async () => {
    buttonNamed(view.container, "Fit View")?.click();
    await vi.advanceTimersByTimeAsync(1000);
  });

  expect(saveViewport).toHaveBeenCalledTimes(1);
  expect(saveViewport.mock.calls[0]?.[0]).toEqual({
    projectId: "project-1",
    screenId: "screen-1",
    viewport: { centerX: 640, centerY: 400, collapsedGroups: [], zoom: 1 },
  });
  expect(save).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(listFetch).not.toHaveBeenCalled();
  expect(wireframeFetch).not.toHaveBeenCalled();
  expect(cache.getQueryData(["viewport"])).toMatchObject({
    viewport: { zoom: 1 },
  });
  await view.unmount();
});
