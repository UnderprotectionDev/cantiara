import { resolveUserFlowViewport } from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";

const frame = { height: 400, width: 800 };
const content = {
  cards: [],
  nodes: [
    { id: "a", kind: "Action", position: { x: 0, y: 0 } },
    { id: "b", kind: "Action", position: { x: 2000, y: 0 } },
  ],
};

describe("meaningful restore and Fit View", () => {
  test("restores a position that still shows content", () => {
    const saved = { center: { x: 100, y: 40 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved })).toEqual({
      collapsed: [],
      mode: "restore",
      viewport: { center: saved.center, zoom: 1 },
    });
  });

  test("fits visible content when nothing was saved", () => {
    expect(resolveUserFlowViewport({ content, frame, saved: null }).mode).toBe(
      "fit",
    );
  });

  test("fits instead of opening on a region outside the content bounds", () => {
    const saved = { center: { x: 90_000, y: -40_000 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe("fit");
  });

  test("fits instead of opening on an empty gap between content", () => {
    const saved = { center: { x: 1000, y: 40 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe("fit");
  });

  test("fits when the content the position showed was deleted", () => {
    const saved = { center: { x: 2100, y: 40 }, collapsed: [], zoom: 1 };
    const remaining = {
      cards: [],
      nodes: [{ id: "a", kind: "Action", position: { x: 0, y: 0 } }],
    };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe(
      "restore",
    );
    expect(
      resolveUserFlowViewport({ content: remaining, frame, saved }).mode,
    ).toBe("fit");
  });

  test("fits an empty canvas and a degenerate frame", () => {
    const saved = { center: { x: 0, y: 0 }, collapsed: [], zoom: 1 };
    expect(
      resolveUserFlowViewport({
        content: { cards: [], nodes: [] },
        frame,
        saved,
      }).mode,
    ).toBe("fit");
    expect(
      resolveUserFlowViewport({
        content,
        frame: { height: 0, width: 0 },
        saved,
      }).mode,
    ).toBe("fit");
  });

  test("content hidden by a collapsed Section does not make a position meaningful", () => {
    const grouped = {
      cards: [],
      nodes: [
        { id: "s", kind: "Section", position: { x: 0, y: 0 } },
        {
          id: "m",
          kind: "Action",
          position: { x: 3000, y: 0 },
          sectionId: "s",
        },
      ],
    };
    const saved = { center: { x: 3100, y: 40 }, collapsed: ["s"], zoom: 1 };
    expect(resolveUserFlowViewport({ content: grouped, frame, saved })).toEqual(
      { collapsed: ["s"], mode: "fit" },
    );
    expect(
      resolveUserFlowViewport({
        content: grouped,
        frame,
        saved: { ...saved, collapsed: [] },
      }).mode,
    ).toBe("restore");
  });
});
