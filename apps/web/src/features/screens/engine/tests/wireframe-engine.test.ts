import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
  resolvedBlocks,
  type WireframeBlock,
  type WireframeDocument,
} from "@cantiara/api/wireframe-document";
import { expect, test } from "vitest";
import { createWireframeEditor } from "../editor";
import { createGeometryIndex } from "../geometry";
import { paintBlock, roughOutline } from "../paint";

const HEX_COLOR = /^#[0-9a-f]{6}$/;
const SOURCE_FILE = /\.(ts|tsx)$/;

function documentWith(...blocks: WireframeBlock[]): WireframeDocument {
  return { ...createEmptyWireframeDocument(), blocks };
}

test("placing Button and Input paints a filled, labeled box with kind marks", () => {
  const button = paintBlock(
    createWireframeBlock("Button", "b", { x: 0, y: 0 }),
  );
  const input = paintBlock(createWireframeBlock("Input", "i", { x: 0, y: 60 }));

  for (const plan of [button, input]) {
    expect(plan.fill).toMatch(HEX_COLOR);
    expect(plan.fill).not.toBe("#ffffff");
    expect(plan.label.length).toBeGreaterThan(0);
    expect(plan.marks.length).toBeGreaterThan(0);
    expect(plan.outline.length).toBeGreaterThan(0);
  }
  expect(button.label).toBe("Button");
  expect(input.marks.some((mark) => mark.type === "text")).toBe(true);
});

test("every closed kind paints a fill and its own marks", () => {
  for (const kind of [
    "Button",
    "Input",
    "Card",
    "Table",
    "Navigation",
    "Chart",
  ] as const) {
    const plan = paintBlock(createWireframeBlock(kind, kind, { x: 0, y: 0 }));
    expect(plan.marks.length).toBeGreaterThan(0);
  }
});

test("Rough.js strokes are deterministic for a fixed per-item seed", () => {
  const block = createWireframeBlock("Card", "card-1", { x: 5, y: 5 });

  expect(roughOutline(block)).toEqual(roughOutline(block));
  expect(roughOutline(block)).not.toEqual(
    roughOutline({ ...block, seed: block.seed + 1 }),
  );
  // A re-render after a move keeps the same seed, so the stroke only translates.
  expect(roughOutline({ ...block, x: 400 })).not.toEqual(roughOutline(block));
});

test("hit-test, selection and snap use canonical geometry, not the drawn stroke", () => {
  const a = createWireframeBlock("Button", "a", { x: 0, y: 0 }); // 140x44
  const b = createWireframeBlock("Card", "b", { x: 300, y: 0 }); // 280x180
  const index = createGeometryIndex([a, b]);

  expect(index.hitTest({ x: 10, y: 10 })).toBe("a");
  expect(index.hitTest({ x: 150, y: 10 })).toBeNull();
  expect(index.hitTest({ x: 320, y: 100 })).toBe("b");
  expect(index.selectInRect({ height: 60, width: 160, x: -5, y: -5 })).toEqual([
    "a",
  ]);
  expect(
    index.selectInRect({ height: 400, width: 700, x: -10, y: -10 }),
  ).toEqual(["a", "b"]);

  // A drag ending near b's left edge snaps to it; far away it does not.
  const near = index.snapMove({
    height: 44,
    id: "a",
    width: 140,
    x: 157,
    y: 3,
  });
  expect(near).toMatchObject({ x: 160, y: 0 });
  expect(near.guides.length).toBeGreaterThan(0);
  const far = index.snapMove({
    height: 44,
    id: "a",
    width: 140,
    x: 700,
    y: 900,
  });
  expect(far).toMatchObject({ guides: [], x: 700, y: 900 });
});

test("a completed gesture is one transaction and undo restores the document", () => {
  const editor = createWireframeEditor(createEmptyWireframeDocument(), {
    createId: () => "block-1",
  });
  let notifications = 0;
  editor.subscribe(() => {
    notifications += 1;
  });

  const placed = editor.placeBlock("Button", { x: 20, y: 20 });
  const afterPlace = notifications;
  editor.commitMove(placed.id, { x: 100, y: 120 });

  // One move gesture is one notification and one history step.
  expect(notifications).toBe(afterPlace + 1);
  expect(editor.getState().document.blocks[0]).toMatchObject({
    x: 100,
    y: 120,
  });
  editor.undo();
  expect(editor.getState().document.blocks[0]).toMatchObject({ x: 20, y: 20 });
  editor.redo();
  expect(editor.getState().document.blocks[0]).toMatchObject({
    x: 100,
    y: 120,
  });
  // Selection is session state; it never enters the document.
  expect(JSON.stringify(editor.getState().document)).not.toContain("selection");
});

test("a failing transaction changes neither document nor history", () => {
  const editor = createWireframeEditor(documentWith());
  const before = editor.getState();

  expect(() =>
    editor.dispatch([{ blockId: "ghost", type: "removeBlock" }]),
  ).toThrow();
  expect(editor.getState()).toBe(before);
});

test("a broken live text reference paints as broken, never empty", () => {
  const text = {
    ...createWireframeBlock("Text", "t", { x: 0, y: 0 }),
    text: {
      mode: "live",
      source: { documentId: "d", sectionId: "s" },
      visibleText: "Last copy",
    },
  } as WireframeBlock;

  const plan = paintBlock(text, {
    sourcePath: "/documents/d#s",
    state: "broken",
    text: "Last copy",
  });

  expect(plan.broken).toBe(true);
  expect(plan.label).toContain("Broken reference");
  expect(plan.label).toContain("Last copy");
  expect(plan.label.trim()).not.toBe("");
});

test("linked instances paint from the shared definition", () => {
  const document = documentWith(
    createWireframeBlock("Navigation", "n", { x: 0, y: 0 }),
  );
  const editor = createWireframeEditor(document);
  const navigation = document.blocks[0] as WireframeBlock;
  editor.dispatch([
    {
      blockId: "n",
      definition: {
        content: {
          height: 56,
          kind: "Navigation",
          label: "Shared",
          props: { items: ["A"] },
          width: 560,
        },
        id: "def",
        name: "Header",
        revision: 1,
      },
      type: "linkBlock",
    },
  ]);

  const [resolved] = resolvedBlocks(editor.getState().document);
  expect(resolved?.label).toBe("Shared");
  expect(navigation.label).toBe("Navigation");
});

const WEB_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");
const FORBIDDEN = [
  "excalidraw",
  "tldraw",
  "fabric",
  "pixi",
  "@tiptap",
  "prosemirror",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return SOURCE_FILE.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

test("no forbidden Wireframe engine or second text model is installed or imported", () => {
  const manifest = JSON.parse(
    readFileSync(join(WEB_ROOT, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const dependencies = Object.keys(manifest.dependencies ?? {});
  const wireframe = dependencies.filter((name) =>
    ["excalidraw", "tldraw", "fabric", "pixi"].some((banned) =>
      name.includes(banned),
    ),
  );
  expect(wireframe).toEqual([]);

  const sources = [
    ...sourceFiles(join(WEB_ROOT, "src", "features", "screens")),
    join(
      WEB_ROOT,
      "..",
      "..",
      "packages",
      "api",
      "src",
      "wireframe-document.ts",
    ),
    join(
      WEB_ROOT,
      "..",
      "..",
      "packages",
      "api",
      "src",
      "wireframe-commands.ts",
    ),
  ];
  for (const file of sources) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const banned of FORBIDDEN) {
      expect(text, `${file} mentions ${banned}`).not.toContain(banned);
    }
  }
});

test("Shantell Sans is canvas typography only, not product UI", () => {
  for (const file of sourceFiles(join(WEB_ROOT, "src"))) {
    if (file.includes(join("features", "screens"))) {
      continue;
    }
    expect(readFileSync(file, "utf8"), file).not.toContain("Shantell");
  }
});
