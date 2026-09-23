import { describe, expect, test } from "vitest";

import { applyBacklogOrder, normalizeBacklogOrder } from "./backlog-order";

describe("Backlog manual order", () => {
  test("moves only active Work while keeping archived Work in its stored slot", () => {
    expect(
      applyBacklogOrder(
        ["work-1", "work-2", "work-3"],
        ["work-1", "work-2", "work-3"],
        ["work-1", "work-3"],
        ["work-3", "work-1"],
      ),
    ).toEqual(["work-3", "work-2", "work-1"]);
  });

  test("appends new Work to the prior order without creating another rank", () => {
    expect(
      normalizeBacklogOrder(["work-2"], ["work-1", "work-2", "work-3"]),
    ).toEqual(["work-2", "work-1", "work-3"]);
  });

  test("rejects a reorder that omits or repeats active Work", () => {
    expect(() =>
      applyBacklogOrder(
        [],
        ["work-1", "work-2"],
        ["work-1", "work-2"],
        ["work-1"],
      ),
    ).toThrow("Backlog order must include every active Work exactly once.");
    expect(() =>
      applyBacklogOrder(
        [],
        ["work-1", "work-2"],
        ["work-1", "work-2"],
        ["work-1", "work-1"],
      ),
    ).toThrow("Backlog order must include every active Work exactly once.");
  });
});
