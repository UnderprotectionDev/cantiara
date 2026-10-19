import { describe, expect, test } from "vitest";

import {
  addNode,
  assignSelectionToSection,
  connectNodes,
  copySelection,
  createEditor,
  deleteSelection,
  disconnectLink,
  type EditorDocument,
  type EditorNode,
  groupSelection,
  moveInOutline,
  paste,
  redo,
  select,
  undo,
} from "./flow-editor";
import { commandForKey } from "./flow-keyboard";
import { buildOutline, hiddenNodeIds, toggleCollapsed } from "./flow-outline";

function node(id: string, patch: Partial<EditorNode> = {}): EditorNode {
  return {
    id,
    kind: "Action",
    position: { x: 0, y: 0 },
    screenId: null,
    sectionId: null,
    style: "default",
    text: id,
    ...patch,
  };
}

function counter(prefix: string) {
  let count = 0;
  return () => {
    count += 1;
    return `${prefix}${count}`;
  };
}

function editor(nodes: EditorNode[], links: EditorDocument["links"] = []) {
  return createEditor({ links, nodes });
}

describe("outline create", () => {
  test("places a node below the content and selects it", () => {
    const state = addNode(editor([node("a", { position: { x: 40, y: 10 } })]), {
      id: "b",
      kind: "Decision",
      text: "Has account?",
    });
    expect(state.document.nodes.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(state.selection).toEqual(["b"]);
    expect(state.document.nodes[1]?.position.x).toBe(40);
    expect(state.document.nodes[1]?.position.y).toBeGreaterThan(10);
  });

  test("a Screen node needs a live Screen id; other kinds carry none", () => {
    const empty = editor([]);
    expect(addNode(empty, { id: "s", kind: "Screen" })).toBe(empty);
    const screen = addNode(empty, { id: "s", kind: "Screen", screenId: "scr" });
    expect(screen.document.nodes[0]?.screenId).toBe("scr");
    const action = addNode(empty, { id: "a", kind: "Action", screenId: "scr" });
    expect(action.document.nodes[0]?.screenId).toBeNull();
  });

  test("refuses a taken id and a full scene", () => {
    const one = editor([node("a")]);
    expect(addNode(one, { id: "a", kind: "Action" })).toBe(one);
    const full = editor(Array.from({ length: 500 }, (_, i) => node(`n${i}`)));
    expect(addNode(full, { id: "x", kind: "Action" })).toBe(full);
  });

  test("live cards count against the same 500 visible items", () => {
    const state = createEditor({
      cards: [
        { id: "c", kind: "Work", position: { x: 0, y: 0 }, recordId: "w" },
      ],
      links: [],
      nodes: Array.from({ length: 499 }, (_, i) => node(`n${i}`)),
    });
    expect(addNode(state, { id: "x", kind: "Action" })).toBe(state);
  });

  test("is one undoable local operation", () => {
    const created = addNode(editor([]), { id: "a", kind: "Action" });
    expect(undo(created).document.nodes).toEqual([]);
    expect(redo(undo(created)).document.nodes).toHaveLength(1);
  });
});

describe("outline reorder", () => {
  test("moves a node among its siblings and stops at the ends", () => {
    const state = editor([node("a"), node("b"), node("c")]);
    expect(
      moveInOutline(state, "c", "up").document.nodes.map(({ id }) => id),
    ).toEqual(["a", "c", "b"]);
    expect(moveInOutline(state, "a", "up")).toBe(state);
    expect(moveInOutline(state, "c", "down")).toBe(state);
  });

  test("skips nodes of another Section", () => {
    const state = editor([
      node("s", { kind: "Section" }),
      node("m1", { sectionId: "s" }),
      node("loose"),
      node("m2", { sectionId: "s" }),
    ]);
    expect(
      moveInOutline(state, "m2", "up").document.nodes.map(({ id }) => id),
    ).toEqual(["s", "m2", "loose", "m1"]);
  });
});

describe("outline group", () => {
  test("groups the selection under a new Section placed above it", () => {
    const state = groupSelection(
      select(editor([node("a", { position: { x: 100, y: 300 } }), node("b")]), [
        "a",
        "b",
      ]),
      "sec",
    );
    const section = state.document.nodes.find(({ id }) => id === "sec");
    expect(section?.kind).toBe("Section");
    expect(section?.position.y).toBeLessThan(0);
    expect(
      state.document.nodes.filter(({ sectionId }) => sectionId === "sec"),
    ).toHaveLength(2);
    expect(state.selection).toEqual(["sec"]);
    expect(undo(state).document.nodes).toHaveLength(2);
  });

  test("does nothing for an empty or Section-only selection", () => {
    const state = editor([node("s", { kind: "Section" }), node("a")]);
    expect(groupSelection(state, "x")).toBe(state);
    expect(
      groupSelection(select(state, ["s"]), "x").document.nodes,
    ).toHaveLength(2);
  });

  test("moves a node to another Section and out of any", () => {
    const state = select(editor([node("s", { kind: "Section" }), node("a")]), [
      "a",
    ]);
    const grouped = assignSelectionToSection(state, "s");
    expect(grouped.document.nodes[1]?.sectionId).toBe("s");
    expect(
      assignSelectionToSection(grouped, null).document.nodes[1]?.sectionId,
    ).toBeNull();
    expect(assignSelectionToSection(state, "a")).toBe(state);
  });

  test("deleting a Section ungroups its members instead of orphaning them", () => {
    const state = deleteSelection(
      select(
        editor([node("s", { kind: "Section" }), node("a", { sectionId: "s" })]),
        ["s"],
      ),
    );
    expect(state.document.nodes).toEqual([node("a", { sectionId: null })]);
  });

  test("a copy stays grouped only when its Section is copied with it", () => {
    const base = editor([
      node("s", { kind: "Section" }),
      node("a", { sectionId: "s" }),
    ]);
    const memberOnly = paste(copySelection(select(base, ["a"])), counter("p"));
    expect(memberOnly.document.nodes.at(-1)?.sectionId).toBeNull();
    const both = paste(copySelection(select(base, ["s", "a"])), counter("q"));
    const copies = both.document.nodes.slice(2);
    expect(copies[1]?.sectionId).toBe(copies[0]?.id);
  });
});

describe("outline bind and unbind", () => {
  test("binds two distinct nodes once and unbinds without touching either", () => {
    const state = editor([node("a"), node("b")]);
    const bound = connectNodes(state, { from: "a", id: "l1", to: "b" });
    expect(bound.document.links).toEqual([
      { from: "a", id: "l1", text: "", to: "b" },
    ]);
    expect(connectNodes(bound, { from: "a", id: "l2", to: "b" })).toBe(bound);
    expect(connectNodes(bound, { from: "a", id: "l3", to: "a" })).toBe(bound);
    expect(connectNodes(bound, { from: "a", id: "l4", to: "zzz" })).toBe(bound);
    const unbound = disconnectLink(bound, "l1");
    expect(unbound.document.links).toEqual([]);
    expect(unbound.document.nodes).toHaveLength(2);
    expect(disconnectLink(unbound, "l1")).toBe(unbound);
  });

  test("refuses the 751st link", () => {
    const nodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`));
    let state = editor(nodes);
    let count = 0;
    for (let from = 0; from < 40 && count < 760; from += 1) {
      for (let to = 0; to < 40 && count < 760; to += 1) {
        if (from !== to) {
          state = connectNodes(state, {
            from: `n${from}`,
            id: `l${count}`,
            to: `n${to}`,
          });
          count += 1;
        }
      }
    }
    expect(state.document.links).toHaveLength(750);
  });
});

describe("view-local collapse and outline rows", () => {
  const document: EditorDocument = {
    links: [],
    nodes: [
      node("s", { kind: "Section" }),
      node("a", { sectionId: "s" }),
      node("b", { sectionId: "s" }),
      node("c"),
    ],
  };

  test("lists members beneath their Section and hides them when collapsed", () => {
    expect(
      buildOutline(document, []).map(({ depth, node: { id } }) => [id, depth]),
    ).toEqual([
      ["s", 0],
      ["a", 1],
      ["b", 1],
      ["c", 0],
    ]);
    const closed = buildOutline(document, ["s"]);
    expect(closed.map(({ node: { id } }) => id)).toEqual(["s", "c"]);
    expect(closed[0]).toMatchObject({ collapsedMembers: 2, isCollapsed: true });
    expect([...hiddenNodeIds(document, ["s"])].sort()).toEqual(["a", "b"]);
  });

  test("collapse of a missing or non-Section id hides nothing", () => {
    expect(hiddenNodeIds(document, ["ghost", "c"]).size).toBe(0);
  });

  test("toggles", () => {
    expect(toggleCollapsed([], "s")).toEqual(["s"]);
    expect(toggleCollapsed(["s"], "s")).toEqual([]);
  });

  test("collapse never enters the document", () => {
    const before = JSON.stringify(document);
    buildOutline(document, ["s"]);
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe("keyboard alternatives of canvas pan, zoom, select and move", () => {
  const key = (init: Partial<Parameters<typeof commandForKey>[0]>) =>
    commandForKey({
      altKey: false,
      ctrlKey: false,
      key: "",
      metaKey: false,
      shiftKey: false,
      ...init,
    });

  test("maps every pointer gesture to a key", () => {
    expect(key({ altKey: true, key: "ArrowLeft" })).toMatchObject({
      type: "pan",
    });
    expect(key({ key: "+" })).toEqual({ type: "zoomIn" });
    expect(key({ key: "-" })).toEqual({ type: "zoomOut" });
    expect(key({ key: "0" })).toEqual({ type: "fitView" });
    expect(key({ ctrlKey: true, key: "a" })).toEqual({ type: "selectAll" });
    expect(key({ key: "ArrowRight" })).toMatchObject({ type: "nudge", dx: 1 });
    expect(key({ key: "Escape" })).toEqual({ type: "clearSelection" });
  });
});
