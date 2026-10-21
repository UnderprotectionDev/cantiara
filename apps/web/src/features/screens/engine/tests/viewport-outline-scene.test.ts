import {
  fitContentViewport,
  isMeaningfulViewport,
  neutralViewport,
  restoreViewport,
  saveScreenViewportInputSchema,
  VIEWPORT_MAX_ZOOM,
  VIEWPORT_MIN_ZOOM,
  visibleRect,
  type WireframeViewport,
  wireframeViewportSchema,
} from "@cantiara/api/screen-viewport";
import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
  parseWireframeDocument,
  resolvedBlocks,
  type WireframeBlock,
  type WireframeDocument,
  wireframeDocumentSchema,
} from "@cantiara/api/wireframe-document";
import { describe, expect, test } from "vitest";
import { createWireframeSnapshot } from "../../output/snapshot";
import { createWireframeEditor } from "../editor";
import { groupOutline, sourceRecordOf } from "../outline";
import { paintBlock } from "../paint";
import {
  buildScene,
  createSceneIndex,
  HARD_SCENE,
  STRESS_SCENE,
} from "../scene";
import { createViewportSession } from "../viewport-session";

const VIEW_FIELDS = /centerX|zoom|collapsedGroups/;
const pane = { height: 600, width: 960 };
const canvas = { height: 800, width: 1280 };

function documentWith(...blocks: WireframeBlock[]): WireframeDocument {
  return { ...createEmptyWireframeDocument(), blocks };
}

const home = createWireframeBlock("Card", "a", { x: 100, y: 100 });
const content = documentWith(
  home,
  createWireframeBlock("Button", "b", { x: 600, y: 300 }),
);

describe("personal viewport restore", () => {
  const saved: WireframeViewport = {
    centerX: 400,
    centerY: 250,
    collapsedGroups: ["Card"],
    zoom: 1.5,
  };

  test("a meaningful saved centre, zoom and collapse come back unchanged", () => {
    expect(restoreViewport(saved, content.blocks, canvas, pane)).toEqual(saved);
  });

  test("no saved value lands on the neutral view", () => {
    expect(restoreViewport(null, content.blocks, canvas, pane)).toEqual(
      neutralViewport(canvas),
    );
  });

  test("a position over an empty region fits the visible content instead", () => {
    const empty = { ...saved, centerX: 9000, centerY: 9000 };
    expect(isMeaningfulViewport(empty, content.blocks, canvas, pane)).toBe(
      false,
    );

    const restored = restoreViewport(empty, content.blocks, canvas, pane);

    expect(restored.collapsedGroups).toEqual(["Card"]);
    expect(isMeaningfulViewport(restored, content.blocks, canvas, pane)).toBe(
      true,
    );
    const window = visibleRect(restored, pane);
    // Every block ends up inside the window it fits.
    for (const block of content.blocks) {
      expect(block.x).toBeGreaterThanOrEqual(window.x);
      expect(block.x + block.width).toBeLessThanOrEqual(
        window.x + window.width,
      );
    }
  });

  test("NaN, infinite and out-of-range saved values fit content, never throw", () => {
    for (const broken of [
      { ...saved, centerX: Number.NaN },
      { ...saved, centerY: Number.POSITIVE_INFINITY },
      { ...saved, zoom: 0 },
      { ...saved, zoom: 1000 },
      { zoom: "big" },
      "garbage",
    ]) {
      const restored = restoreViewport(broken, content.blocks, canvas, pane);
      expect(wireframeViewportSchema.safeParse(restored).success).toBe(true);
      expect(isMeaningfulViewport(restored, content.blocks, canvas, pane)).toBe(
        true,
      );
    }
  });

  test("an empty canvas fits the canvas, not a hole", () => {
    const restored = restoreViewport(
      { ...saved, centerX: -5000 },
      [],
      canvas,
      pane,
    );
    expect(restored.centerX).toBe(canvas.width / 2);
    expect(restored.zoom).toBeGreaterThanOrEqual(VIEWPORT_MIN_ZOOM);
    expect(restored.zoom).toBeLessThanOrEqual(VIEWPORT_MAX_ZOOM);
  });

  test("Fit View returns to the neutral view and keeps only view-local collapse", () => {
    const session = createViewportSession({ ...saved, zoom: 3 });

    const next = session.fitView(canvas);

    expect(next).toEqual({
      ...neutralViewport(canvas),
      collapsedGroups: ["Card"],
    });
    expect(session.getState()).toBe(next);
  });

  test("a restored view carries no selection, inspector or edit state", () => {
    const editor = createWireframeEditor(content);
    const session = createViewportSession(
      restoreViewport(saved, content.blocks, canvas, pane),
    );

    expect(editor.getState().selection).toEqual([]);
    expect(Object.keys(session.getState()).sort()).toEqual([
      "centerX",
      "centerY",
      "collapsedGroups",
      "zoom",
    ]);
    expect(
      wireframeViewportSchema.safeParse({ ...saved, selection: ["a"] }).success,
    ).toBe(false);
    expect(
      saveScreenViewportInputSchema.safeParse({
        projectId: "p",
        screenId: "s",
        viewport: { ...saved, editing: "a" },
      }).success,
    ).toBe(false);
  });

  test("pan, zoom and collapse never become document history", () => {
    const editor = createWireframeEditor(content);
    const session = createViewportSession(neutralViewport(canvas));

    session.pan(80, 0);
    session.zoom(1.25);
    session.toggleGroup("Card");

    expect(editor.getState().canUndo).toBe(false);
    expect(editor.getState().document).toBe(content);
  });
});

describe("viewport is not content, share or export input", () => {
  test("a snapshot is the document only; the digest ignores any saved view", () => {
    const first = createWireframeSnapshot({
      document: content,
      latestVersion: 1,
      screenId: "s",
      title: "Home",
      version: 1,
    });

    expect(Object.keys(first).sort()).toEqual([
      "digest",
      "document",
      "screenId",
      "sealed",
      "title",
      "version",
    ]);
    expect(JSON.stringify(first)).not.toMatch(VIEW_FIELDS);
    // A viewport smuggled into the stored document is refused, not exported.
    expect(() =>
      createWireframeSnapshot({
        document: { ...content, viewport: { centerX: 1 } },
        latestVersion: 1,
        screenId: "s",
        title: "Home",
        version: 1,
      }),
    ).toThrow();
  });

  test("no command can write a viewport into the document", () => {
    expect(
      wireframeDocumentSchema.safeParse({
        ...content,
        viewport: neutralViewport(canvas),
      }).success,
    ).toBe(false);
    expect(() =>
      applyWireframeTransaction(content, [{ type: "setViewport" } as never]),
    ).toThrow();
  });
});

describe("keyboard-equivalent document tasks", () => {
  test("reorder changes paint order as one undoable transaction", () => {
    const editor = createWireframeEditor(content);

    editor.reorder("a", 1);

    expect(editor.getState().document.blocks.map(({ id }) => id)).toEqual([
      "b",
      "a",
    ]);
    editor.undo();
    expect(editor.getState().document.blocks.map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
    editor.reorder("a", -1);
    expect(editor.getState().canUndo).toBe(false);
  });

  test("move and align the selection without a pointer", () => {
    const editor = createWireframeEditor(content);
    editor.select(["a", "b"]);

    editor.moveSelection(8, 16);
    expect(editor.getState().document.blocks.map(({ x, y }) => [x, y])).toEqual(
      [
        [108, 116],
        [608, 316],
      ],
    );
    editor.alignSelection("left");

    const xs = editor.getState().document.blocks.map(({ x }) => x);
    expect(new Set(xs).size).toBe(1);
    expect(xs[0]).toBe(108);
    // One alignment is one transaction.
    editor.undo();
    expect(editor.getState().document.blocks.map(({ x }) => x)).toEqual([
      108, 608,
    ]);
  });

  test("selectStep walks the outline and wraps", () => {
    const editor = createWireframeEditor(content);

    editor.selectStep(1);
    expect(editor.getState().selection).toEqual(["a"]);
    editor.selectStep(1);
    editor.selectStep(1);
    expect(editor.getState().selection).toEqual(["a"]);
    editor.selectStep(-1);
    expect(editor.getState().selection).toEqual(["b"]);
  });

  test("outline groups by kind and names the source record behind a block", () => {
    const live: WireframeBlock = {
      ...createWireframeBlock("Text", "t", { x: 0, y: 0 }),
      text: {
        mode: "live",
        source: { documentId: "doc-1", sectionId: "intro" },
        visibleText: "Hi",
      },
    } as WireframeBlock;

    expect(groupOutline([...content.blocks, live]).map(({ id }) => id)).toEqual(
      ["Card", "Button", "Text"],
    );
    expect(sourceRecordOf(live)).toMatchObject({
      documentId: "doc-1",
      kind: "document",
    });
    expect(sourceRecordOf(home)).toBeNull();
  });
});

describe("performance scene", () => {
  function frame(
    index: ReturnType<typeof createSceneIndex>,
    rect: { height: number; width: number; x: number; y: number },
  ) {
    return {
      blocks: index.visibleBlockIds(rect),
      links: index.visibleLinks(rect),
    };
  }

  test("builds the hard 500/750 scene deterministically and validly", () => {
    const first = buildScene(HARD_SCENE);
    const second = buildScene(HARD_SCENE);

    expect(first.document.blocks).toHaveLength(500);
    expect(first.links).toHaveLength(750);
    expect(first).toEqual(second);
    expect(wireframeDocumentSchema.safeParse(first.document).success).toBe(
      true,
    );
  });

  test("culling returns exactly the blocks and links that touch the window", () => {
    const { document, links } = buildScene(HARD_SCENE);
    const index = createSceneIndex(document.blocks, links);
    // Window over the first grid cell only.
    const rect = { height: 150, width: 250, x: -10, y: -10 };

    const visible = frame(index, rect);

    const expected = document.blocks
      .filter(
        (block) =>
          block.x < rect.x + rect.width &&
          block.x + block.width > rect.x &&
          block.y < rect.y + rect.height &&
          block.y + block.height > rect.y,
      )
      .map(({ id }) => id);
    expect(visible.blocks).toEqual(expected);
    expect(visible.blocks.length).toBeLessThan(10);
    expect(visible.links.length).toBeLessThan(links.length);
    // Culled output keeps document paint order.
    expect(visible.blocks).toEqual(
      [...visible.blocks].sort(
        (a, b) =>
          document.blocks.findIndex(({ id }) => id === a) -
          document.blocks.findIndex(({ id }) => id === b),
      ),
    );
  });

  test("500 visible items and 750 links fit in a frame: query and cached plans", () => {
    const { document, links } = buildScene(HARD_SCENE);
    const blocks = resolvedBlocks(document);
    const index = createSceneIndex(blocks, links);
    // A window wide enough that all 500 items and 750 links are visible.
    const rect = { height: 20_000, width: 20_000, x: -100, y: -100 };
    const plans = new Map(blocks.map((block) => [block.id, paintBlock(block)]));

    const frames = 60;
    const start = performance.now();
    let drawn = 0;
    for (let step = 0; step < frames; step += 1) {
      const visible = frame(index, { ...rect, x: rect.x + step });
      drawn += visible.blocks.map((id) => plans.get(id)).length;
      expect(visible.links).toHaveLength(750);
    }
    const perFrame = (performance.now() - start) / frames;

    expect(drawn).toBe(500 * frames);
    // Culling and plan lookup are a small slice of the 16.7 ms frame.
    expect(perFrame).toBeLessThan(16);
  });

  test("2,000 items and 3,000 links neither crash nor corrupt", () => {
    const { document, links } = buildScene(STRESS_SCENE);

    const parsed = parseWireframeDocument(document);
    expect(parsed.blocks).toHaveLength(2000);
    const index = createSceneIndex(parsed.blocks, links);
    const everything = {
      height: 100_000,
      width: 100_000,
      x: -1000,
      y: -1000,
    };

    expect(index.visibleBlockIds(everything)).toHaveLength(2000);
    expect(index.visibleLinks(everything)).toHaveLength(3000);
    // The index never mutates the canonical document.
    expect(document).toEqual(buildScene(STRESS_SCENE).document);
    const editor = createWireframeEditor(parsed);
    editor.moveSelection(1, 1);
    expect(editor.getState().document).toBe(parsed);
    expect(
      fitContentViewport(parsed.blocks, canvas, pane).zoom,
    ).toBeGreaterThanOrEqual(VIEWPORT_MIN_ZOOM);
  });

  test("a geometry query never holds canonical React state per pointer move", () => {
    const { document, links } = buildScene(HARD_SCENE);
    const editor = createWireframeEditor(document);
    const index = createSceneIndex(document.blocks, links);
    let notified = 0;
    editor.subscribe(() => {
      notified += 1;
    });

    for (let step = 0; step < 100; step += 1) {
      frame(index, { height: 600, width: 900, x: step * 5, y: 0 });
    }

    expect(notified).toBe(0);
  });
});
