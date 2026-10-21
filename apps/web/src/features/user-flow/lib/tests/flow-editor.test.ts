import {
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_NODE_LIMIT,
  USER_FLOW_NODE_TONES,
  userFlowDocumentInputSchema,
} from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";

import {
  alignSelection,
  canRedo,
  canUndo,
  clearSelection,
  copySelection,
  createEditor,
  deleteSelection,
  type EditorDocument,
  type EditorNode,
  GRID_SIZE,
  isDirty,
  markSaved,
  moveSelection,
  NODE_HEIGHT,
  NODE_WIDTH,
  PASTE_OFFSET,
  paste,
  redo,
  removeCard,
  reorderSelection,
  select,
  selectAll,
  setCardPositions,
  setNodePositions,
  setSelectionStyle,
  setSelectionText,
  snapSelectionToGrid,
  snapToGrid,
  undo,
} from "../flow-editor";
import { commandForKey, type KeyInput } from "../flow-keyboard";
import { contrastRatio, MIN_TEXT_CONTRAST, TONE_COLORS } from "../flow-style";

function node(id: string, patch: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    kind: "Action",
    position: { x: 0, y: 0 },
    screenId: null,
    style: "default",
    text: id,
    ...patch,
  };
}

function editor(nodes: EditorNode[], links: EditorDocument["links"] = []) {
  return createEditor({ links, nodes });
}

function ids(state: { document: EditorDocument }) {
  return state.document.nodes.map(({ id }) => id);
}

function counter() {
  let n = 0;
  return () => {
    n += 1;
    return `fresh-${n}`;
  };
}

describe("selection", () => {
  const base = editor([node("a"), node("b"), node("c")]);

  test("replace, add and toggle build a multi-selection in document order", () => {
    let state = select(base, ["c"]);
    expect(state.selection).toEqual(["c"]);
    state = select(state, ["a"], "add");
    expect(state.selection).toEqual(["a", "c"]);
    state = select(state, ["c", "b"], "toggle");
    expect(state.selection).toEqual(["a", "b"]);
    expect(selectAll(state).selection).toEqual(["a", "b", "c"]);
    expect(clearSelection(state).selection).toEqual([]);
  });

  test("unknown ids are never selected", () => {
    expect(select(base, ["ghost", "a"]).selection).toEqual(["a"]);
  });

  test("selection is not an undoable operation and does not dirty the document", () => {
    const state = select(base, ["a", "b"]);
    expect(canUndo(state)).toBe(false);
    expect(isDirty(state)).toBe(false);
  });
});

describe("move and grid snap", () => {
  test("snapToGrid rounds to the nearest grid line", () => {
    expect(snapToGrid(7)).toBe(0);
    expect(snapToGrid(9)).toBe(GRID_SIZE);
    expect(snapToGrid(-9)).toBe(-GRID_SIZE);
  });

  test("moves only the selection, by a delta", () => {
    const state = moveSelection(select(editor([node("a"), node("b")]), ["a"]), {
      dx: 5,
      dy: -3,
    });
    expect(state.document.nodes[0]?.position).toEqual({ x: 5, y: -3 });
    expect(state.document.nodes[1]?.position).toEqual({ x: 0, y: 0 });
  });

  test("a move with snap lands on the grid", () => {
    const state = moveSelection(
      select(editor([node("a", { position: { x: 3, y: 5 } })]), ["a"]),
      { dx: 10, dy: 10 },
      { snap: true },
    );
    expect(state.document.nodes[0]?.position).toEqual({ x: 16, y: 16 });
  });

  test("snapping the selection moves it onto the grid and undoes", () => {
    const start = select(editor([node("a", { position: { x: 21, y: 30 } })]), [
      "a",
    ]);
    const snapped = snapSelectionToGrid(start);
    expect(snapped.document.nodes[0]?.position).toEqual({ x: 16, y: 32 });
    expect(undo(snapped).document).toBe(start.document);
  });

  test("drag end applies absolute positions, optionally snapped", () => {
    const state = setNodePositions(
      editor([node("a"), node("b")]),
      new Map([["a", { x: 37, y: 41 }]]),
      { snap: true },
    );
    expect(state.document.nodes[0]?.position).toEqual({ x: 32, y: 48 });
    expect(state.document.nodes[1]?.position).toEqual({ x: 0, y: 0 });
  });

  test("an operation that changes nothing is not recorded", () => {
    const state = moveSelection(select(editor([node("a")]), ["a"]), {
      dx: 0,
      dy: 0,
    });
    expect(canUndo(state)).toBe(false);
  });
});

describe("align", () => {
  const start = select(
    editor([
      node("a", { position: { x: 10, y: 100 } }),
      node("b", { position: { x: 300, y: 20 } }),
      node("c", { position: { x: 600, y: 400 } }),
    ]),
    ["a", "b"],
  );

  test("aligns the selection to its shared edge or centre", () => {
    const at = (state: typeof start, index: number) =>
      state.document.nodes[index]?.position;
    expect(at(alignSelection(start, "left"), 1)).toEqual({ x: 10, y: 20 });
    expect(at(alignSelection(start, "right"), 0)).toEqual({
      x: 300,
      y: 100,
    });
    expect(at(alignSelection(start, "top"), 0)).toEqual({ x: 10, y: 20 });
    expect(at(alignSelection(start, "bottom"), 1)).toEqual({
      x: 300,
      y: 100,
    });
    expect(at(alignSelection(start, "center"), 0)?.x).toBe(
      (10 + 300 + NODE_WIDTH) / 2 - NODE_WIDTH / 2,
    );
    expect(at(alignSelection(start, "middle"), 1)?.y).toBe(
      (20 + 100 + NODE_HEIGHT) / 2 - NODE_HEIGHT / 2,
    );
  });

  test("leaves unselected nodes alone and needs two nodes", () => {
    expect(alignSelection(start, "left").document.nodes[2]?.position).toEqual({
      x: 600,
      y: 400,
    });
    const single = select(start, ["a"]);
    expect(alignSelection(single, "left")).toBe(single);
  });
});

describe("z-order", () => {
  const start = editor([node("a"), node("b"), node("c"), node("d")]);

  test("front and back keep the relative order of the selection", () => {
    const state = select(start, ["a", "c"]);
    expect(ids(reorderSelection(state, "front"))).toEqual(["b", "d", "a", "c"]);
    expect(ids(reorderSelection(state, "back"))).toEqual(["a", "c", "b", "d"]);
  });

  test("forward and backward move one step past an unselected neighbour", () => {
    expect(ids(reorderSelection(select(start, ["b"]), "forward"))).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(ids(reorderSelection(select(start, ["c"]), "backward"))).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    const top = select(start, ["d"]);
    expect(reorderSelection(top, "forward").document).toBe(top.document);
  });
});

describe("node fields", () => {
  test("text and style change the selection without touching kind or screen", () => {
    const start = select(
      editor([
        node("s", { kind: "Screen", screenId: "screen-1" }),
        node("d", { kind: "Decision" }),
      ]),
      ["s", "d"],
    );
    for (const tone of USER_FLOW_NODE_TONES) {
      const styled = setSelectionStyle(start, tone);
      expect(styled.document.nodes.map(({ kind }) => kind)).toEqual([
        "Screen",
        "Decision",
      ]);
      expect(styled.document.nodes[0]?.screenId).toBe("screen-1");
    }
    const texted = setSelectionText(start, "Pays");
    expect(texted.document.nodes.map(({ text }) => text)).toEqual([
      "Pays",
      "Pays",
    ]);
  });
});

describe("delete", () => {
  test("removes the selected nodes and the links that would dangle", () => {
    const start = select(
      editor(
        [node("a"), node("b"), node("c")],
        [
          { from: "a", id: "l1", text: "", to: "b" },
          { from: "b", id: "l2", text: "", to: "c" },
        ],
      ),
      ["b"],
    );
    const state = deleteSelection(start);
    expect(ids(state)).toEqual(["a", "c"]);
    expect(state.document.links).toEqual([]);
    expect(state.selection).toEqual([]);
    expect(undo(state).document).toBe(start.document);
  });

  test("deleting with nothing selected does nothing", () => {
    const start = editor([node("a")]);
    expect(deleteSelection(start)).toBe(start);
  });
});

describe("copy and paste", () => {
  test("pastes fresh ids, offset, and selects the pasted nodes", () => {
    const start = select(
      editor([node("a", { position: { x: 10, y: 10 } }), node("b")]),
      ["a"],
    );
    const state = paste(copySelection(start), counter());
    expect(ids(state)).toEqual(["a", "b", "fresh-1"]);
    expect(state.document.nodes[2]).toMatchObject({
      position: { x: 10 + PASTE_OFFSET, y: 10 + PASTE_OFFSET },
      text: "a",
    });
    expect(state.selection).toEqual(["fresh-1"]);
    const again = paste(state, counter());
    expect(again.document.nodes[3]?.position).toEqual({
      x: 10 + PASTE_OFFSET * 2,
      y: 10 + PASTE_OFFSET * 2,
    });
  });

  test("a pasted Screen node keeps its live reference and copies no Screen", () => {
    const start = select(
      editor([
        node("s", { kind: "Screen", screenId: "screen-1", text: "Pay" }),
      ]),
      ["s"],
    );
    const state = paste(copySelection(start), counter());
    const [, pasted] = state.document.nodes;
    expect(pasted).toMatchObject({
      id: "fresh-1",
      kind: "Screen",
      screenId: "screen-1",
    });
    expect(Object.keys(pasted ?? {}).sort()).toEqual(
      [
        "id",
        "kind",
        "position",
        "screenId",
        "sectionId",
        "style",
        "text",
      ].sort(),
    );
  });

  test("links between copied nodes follow the fresh ids; outside links do not", () => {
    const start = select(
      editor(
        [node("a"), node("b"), node("c")],
        [
          { from: "a", id: "l1", text: "go", to: "b" },
          { from: "b", id: "l2", text: "", to: "c" },
        ],
      ),
      ["a", "b"],
    );
    const state = paste(copySelection(start), counter());
    const added = state.document.links.slice(2);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      from: "fresh-1",
      text: "go",
      to: "fresh-2",
    });
    expect(added[0]?.id).not.toBe("l1");
  });

  test("fresh ids never collide with existing ids", () => {
    const start = select(editor([node("fresh-1")]), ["fresh-1"]);
    const state = paste(copySelection(start), counter());
    expect(ids(state)).toEqual(["fresh-1", "fresh-2"]);
  });

  test("an empty clipboard pastes nothing, and paste undoes in one step", () => {
    const empty = editor([node("a")]);
    expect(paste(empty, counter())).toBe(empty);
    const start = select(empty, ["a"]);
    const pasted = paste(copySelection(start), counter());
    expect(undo(pasted).document).toBe(start.document);
  });

  test("a paste that would exceed the scene limit is refused", () => {
    const nodes = Array.from({ length: USER_FLOW_NODE_LIMIT }, (_, index) =>
      node(`n${index}`),
    );
    const start = select(editor(nodes), ["n0"]);
    const state = paste(copySelection(start), counter());
    expect(state.document).toBe(start.document);
    expect(USER_FLOW_LINK_LIMIT).toBeGreaterThan(0);
  });

  test("the edited document is accepted by the strict API contract", () => {
    const start = select(
      editor([
        node("s", { kind: "Screen", screenId: "screen-1" }),
        node("d", { kind: "Decision", style: "red" }),
      ]),
      ["s", "d"],
    );
    const state = paste(copySelection(start), counter());
    expect(userFlowDocumentInputSchema.safeParse(state.document).success).toBe(
      true,
    );
  });
});

describe("undo and redo", () => {
  test("undo reverts the latest local operation and redo re-applies it", () => {
    const start = select(editor([node("a"), node("b")]), ["a"]);
    const moved = moveSelection(start, { dx: 10, dy: 0 });
    const deleted = deleteSelection(moved);
    expect(canUndo(deleted)).toBe(true);
    const back = undo(deleted);
    expect(back.document).toBe(moved.document);
    expect(canRedo(back)).toBe(true);
    expect(redo(back).document).toBe(deleted.document);
    expect(undo(undo(back)).document).toBe(start.document);
  });

  test("a new operation clears the redo branch", () => {
    const start = select(editor([node("a")]), ["a"]);
    const back = undo(moveSelection(start, { dx: 1, dy: 0 }));
    const forked = moveSelection(back, { dx: 2, dy: 0 });
    expect(canRedo(forked)).toBe(false);
  });

  test("undo drops selection of nodes that no longer exist", () => {
    const start = select(editor([node("a")]), ["a"]);
    const pasted = paste(copySelection(start), counter());
    expect(pasted.selection).toEqual(["fresh-1"]);
    expect(undo(pasted).selection).toEqual([]);
  });

  test("undo and redo with empty history are no-ops", () => {
    const start = editor([node("a")]);
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  test("a save is a version boundary: history is cleared and dirty resets", () => {
    const start = select(editor([node("a")]), ["a"]);
    const moved = moveSelection(start, { dx: 10, dy: 0 });
    expect(isDirty(moved)).toBe(true);
    const saved = markSaved(moved, moved.document);
    expect(isDirty(saved)).toBe(false);
    expect(canUndo(saved)).toBe(false);
    expect(undo(saved)).toBe(saved);
  });

  test("undoing back to the saved document is clean again", () => {
    const start = editor([node("a")]);
    const moved = moveSelection(select(start, ["a"]), { dx: 4, dy: 0 });
    expect(isDirty(undo(moved))).toBe(false);
  });

  test("history is bounded", () => {
    let state = select(editor([node("a")]), ["a"]);
    for (let index = 0; index < 150; index += 1) {
      state = moveSelection(state, { dx: 1, dy: 0 });
    }
    expect(state.past).toHaveLength(100);
  });
});

describe("style never carries semantics", () => {
  test("kind is the only type system: every tone keeps kind and passes the contract", () => {
    for (const kind of [
      "Screen",
      "Action",
      "Decision",
      "State/Outcome",
      "Section",
    ] as const) {
      for (const tone of USER_FLOW_NODE_TONES) {
        const state = setSelectionStyle(
          select(
            editor([
              node("n", {
                kind,
                screenId: kind === "Screen" ? "screen-1" : null,
              }),
            ]),
            ["n"],
          ),
          tone,
        );
        expect(state.document.nodes[0]?.kind).toBe(kind);
        expect(
          userFlowDocumentInputSchema.safeParse(state.document).success,
        ).toBe(true);
      }
    }
  });

  test("every tone keeps accessible text contrast", () => {
    expect(Object.keys(TONE_COLORS).sort()).toEqual(
      [...USER_FLOW_NODE_TONES].sort(),
    );
    for (const colors of Object.values(TONE_COLORS)) {
      expect(
        contrastRatio(colors.foreground, colors.background),
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

describe("keyboard alternatives", () => {
  function key(partial: Partial<KeyInput> & { key: string }): KeyInput {
    return {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...partial,
    };
  }

  test("covers select, copy, paste, undo, redo, delete and z-order", () => {
    expect(commandForKey(key({ key: "a", metaKey: true }))).toEqual({
      type: "selectAll",
    });
    expect(commandForKey(key({ ctrlKey: true, key: "c" }))).toEqual({
      type: "copy",
    });
    expect(commandForKey(key({ key: "v", metaKey: true }))).toEqual({
      type: "paste",
    });
    expect(commandForKey(key({ key: "z", metaKey: true }))).toEqual({
      type: "undo",
    });
    expect(
      commandForKey(key({ key: "z", metaKey: true, shiftKey: true })),
    ).toEqual({ type: "redo" });
    expect(commandForKey(key({ key: "Delete" }))).toEqual({ type: "delete" });
    expect(commandForKey(key({ key: "]", metaKey: true }))).toEqual({
      move: "forward",
      type: "reorder",
    });
    expect(
      commandForKey(key({ key: "{", metaKey: true, shiftKey: true })),
    ).toEqual({ move: "back", type: "reorder" });
    expect(commandForKey(key({ key: "Escape" }))).toEqual({
      type: "clearSelection",
    });
  });

  test("covers pan, zoom, fit view, fit selection, grid and align", () => {
    expect(commandForKey(key({ altKey: true, key: "ArrowLeft" }))).toEqual({
      dx: -80,
      dy: 0,
      type: "pan",
    });
    expect(commandForKey(key({ key: "+" }))).toEqual({ type: "zoomIn" });
    expect(commandForKey(key({ key: "-" }))).toEqual({ type: "zoomOut" });
    expect(commandForKey(key({ key: "0" }))).toEqual({ type: "fitView" });
    expect(commandForKey(key({ key: ")", shiftKey: true }))).toEqual({
      type: "fitSelection",
    });
    expect(commandForKey(key({ key: "g" }))).toEqual({ type: "snapToGrid" });
    expect(
      commandForKey(
        key({ altKey: true, code: "KeyL", key: "¬", shiftKey: true }),
      ),
    ).toEqual({ edge: "left", type: "align" });
  });

  test("arrows nudge the selection by one unit, or one grid step with Shift", () => {
    expect(commandForKey(key({ key: "ArrowRight" }))).toEqual({
      dx: 1,
      dy: 0,
      type: "nudge",
    });
    expect(commandForKey(key({ key: "ArrowUp", shiftKey: true }))).toEqual({
      dx: 0,
      dy: -16,
      type: "nudge",
    });
  });

  test("unrelated keys are left alone", () => {
    expect(commandForKey(key({ key: "q" }))).toBeNull();
    expect(commandForKey(key({ key: "q", metaKey: true }))).toBeNull();
  });
});

describe("read-only live cards", () => {
  const card = {
    id: "card-1",
    kind: "Work" as const,
    position: { x: 10, y: 20 },
    recordId: "work-1",
  };
  const base = createEditor({
    cards: [card],
    links: [],
    nodes: [node("a"), node("b")],
  });

  test("moving a card changes only its position in the flow document", () => {
    const moved = setCardPositions(
      base,
      new Map([["card-1", { x: 100, y: 200 }]]),
    );
    expect(moved.document.cards).toEqual([
      { ...card, position: { x: 100, y: 200 } },
    ]);
    expect(moved.document.cards?.[0]?.recordId).toBe("work-1");
    expect(canUndo(moved)).toBe(true);
    expect(undo(moved).document.cards).toEqual([card]);
  });

  test("removing a card removes it from the flow only and is undoable", () => {
    const removed = removeCard(base, "card-1");
    expect(removed.document.cards).toEqual([]);
    expect(undo(removed).document.cards).toEqual([card]);
    expect(removeCard(base, "missing")).toBe(base);
  });

  test("node operations carry cards through unchanged", () => {
    let state = select(base, ["a"]);
    state = deleteSelection(state);
    expect(state.document.cards).toEqual([card]);
    state = select(base, ["b"]);
    state = paste(copySelection(state), counter());
    expect(state.document.cards).toEqual([card]);
    state = moveSelection(select(base, ["a"]), { dx: 5, dy: 5 });
    expect(state.document.cards).toEqual([card]);
  });

  test("the saved document shape accepts cards by record id only", () => {
    const parsed = userFlowDocumentInputSchema.safeParse({
      cards: [
        { id: "card-1", kind: "Work", position: { x: 1, y: 2 }, recordId: "w" },
      ],
      links: [],
      nodes: [],
    });
    expect(parsed.success).toBe(true);
    const copied = userFlowDocumentInputSchema.safeParse({
      cards: [
        {
          id: "card-1",
          kind: "Work",
          recordId: "w",
          title: "copied title",
        },
      ],
      links: [],
      nodes: [],
    });
    expect(copied.success).toBe(false);
    const wrongKind = userFlowDocumentInputSchema.safeParse({
      cards: [{ id: "c", kind: "Screen", recordId: "w" }],
      links: [],
      nodes: [],
    });
    expect(wrongKind.success).toBe(false);
  });
});
