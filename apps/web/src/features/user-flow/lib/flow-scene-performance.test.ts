import {
  resolveUserFlowViewport,
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_NODE_LIMIT,
  userFlowDocumentInputSchema,
} from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";

import {
  alignSelection,
  connectNodes,
  copySelection,
  createEditor,
  type EditorDocument,
  type EditorState,
  groupSelection,
  moveInOutline,
  moveSelection,
  paste,
  reorderSelection,
  selectAll,
  setNodePositions,
  undo,
} from "./flow-editor";
import { buildOutline, hiddenNodeIds } from "./flow-outline";

/**
 * Hard performance scene of spec 49 #374: 500 visible items and 750 links.
 *
 * What this measures: the pure editor model and the outline derivation that
 * every canvas gesture runs per interaction, in Node on the build machine,
 * against a 16.7 ms frame (60 fps). It does NOT measure React Flow painting,
 * layout or GPU time: those need a real browser. The canvas relies on React
 * Flow's `onlyRenderVisibleElements` so paint cost follows the viewport, not
 * the 500 nodes.
 */
const FRAME_MS = 16.7;
const SAMPLES = 15;

function scene(): EditorDocument {
  const nodes = Array.from({ length: USER_FLOW_NODE_LIMIT }, (_, index) => ({
    id: `n${index}`,
    kind: "Action" as const,
    position: { x: (index % 25) * 260, y: Math.floor(index / 25) * 140 },
    screenId: null,
    sectionId: null,
    style: "default" as const,
    text: `Step ${index}`,
  }));
  const links = Array.from({ length: USER_FLOW_LINK_LIMIT }, (_, index) => ({
    from: `n${index % USER_FLOW_NODE_LIMIT}`,
    id: `l${index}`,
    text: "",
    to: `n${(index * 7 + 1) % USER_FLOW_NODE_LIMIT}`,
  }));
  return { links, nodes };
}

/** Median of repeated runs; the first run warms the JIT and is dropped. */
function median(run: () => unknown) {
  run();
  const times: number[] = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? 0;
}

describe("500 visible / 750 link hard scene", () => {
  test("the contract accepts the full scene and nothing larger", () => {
    const { links, nodes } = scene();
    expect(
      userFlowDocumentInputSchema.safeParse({ links, nodes }).success,
    ).toBe(true);
    expect(
      userFlowDocumentInputSchema.safeParse({
        links,
        nodes: [...nodes, { ...nodes[0], id: "extra" }],
      }).success,
    ).toBe(false);
    expect(
      userFlowDocumentInputSchema.safeParse({
        links: [...links, { from: "n0", id: "extra", text: "", to: "n1" }],
        nodes,
      }).success,
    ).toBe(false);
  });

  test("validating the full document fits in a few frames", () => {
    const { links, nodes } = scene();
    const ms = median(() =>
      userFlowDocumentInputSchema.parse({ links, nodes }),
    );
    // One save validates once; it is not per-frame work.
    expect(ms).toBeLessThan(FRAME_MS * 6);
  });

  const full = createEditor(scene());
  const everything = selectAll(full);
  const operations: [string, () => unknown][] = [
    ["select all", () => selectAll(full)],
    [
      "nudge 500 selected nodes",
      () => moveSelection(everything, { dx: 1, dy: 0 }),
    ],
    ["align 500 selected nodes", () => alignSelection(everything, "left")],
    [
      "bring 500 selected nodes to front",
      () => reorderSelection(everything, "front"),
    ],
    [
      "drag-end of 500 node positions",
      () =>
        setNodePositions(
          full,
          new Map(full.document.nodes.map((n) => [n.id, { x: 1, y: 2 }])),
        ),
    ],
    [
      "copy and paste 250 nodes",
      () => {
        let id = 0;
        const nextId = () => {
          id += 1;
          return `p${id}`;
        };
        const half = {
          ...full,
          document: {
            links: [],
            nodes: full.document.nodes.slice(0, 250),
          },
        } as EditorState;
        return paste(copySelection(selectAll(half)), nextId);
      },
    ],
    ["move one node in the outline", () => moveInOutline(full, "n250", "up")],
    ["group 500 nodes into a Section", () => groupSelection(everything, "sec")],
    [
      "undo after a full-scene move",
      () => undo(moveSelection(everything, { dx: 1, dy: 1 })),
    ],
    ["outline rows for 500 nodes", () => buildOutline(full.document, [])],
    [
      "collapse lookup for 500 nodes",
      () => hiddenNodeIds(full.document, ["x"]),
    ],
    [
      "viewport restore decision",
      () =>
        resolveUserFlowViewport({
          content: { cards: [], nodes: full.document.nodes },
          frame: { height: 360, width: 800 },
          saved: { center: { x: 3000, y: 1000 }, collapsed: [], zoom: 1 },
        }),
    ],
  ];

  for (const [name, run] of operations) {
    test(`${name} stays inside one frame`, () => {
      expect(median(run)).toBeLessThan(FRAME_MS);
    });
  }

  test("a full scene refuses a 501st item and a 751st link at the editor", () => {
    const state = connectNodes(full, { from: "n0", id: "x", to: "n3" });
    expect(state.document.links).toHaveLength(USER_FLOW_LINK_LIMIT);
  });
});
