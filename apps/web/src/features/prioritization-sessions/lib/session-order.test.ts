import { describe, expect, test } from "vitest";

import { moveWorkInOrder, workPosition } from "./session-order";

describe("Prioritization session ordering", () => {
  test("moves one Work within the local order without changing other identifiers", () => {
    expect(
      moveWorkInOrder(["work-1", "work-2", "work-3"], "work-2", 1),
    ).toEqual(["work-1", "work-3", "work-2"]);
  });

  test("keeps boundary moves unchanged and reports positions independently", () => {
    const backlogOrder = ["work-2", "work-1"];
    expect(moveWorkInOrder(backlogOrder, "work-2", -1)).toEqual(backlogOrder);
    expect(workPosition(backlogOrder, "work-2")).toBe(1);
    expect(workPosition(["work-1", "work-2"], "work-2")).toBe(2);
    expect(workPosition(backlogOrder, "work-3")).toBeNull();
  });
});
