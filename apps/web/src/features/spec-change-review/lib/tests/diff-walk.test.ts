import { expect, test } from "vitest";

import { walkIndex, walkStatus } from "../diff-walk";

test("the walk starts at the first or last change and stops at both ends", () => {
  expect(walkIndex(null, 3, "next")).toBe(0);
  expect(walkIndex(null, 3, "previous")).toBe(2);
  expect(walkIndex(2, 3, "next")).toBe(2);
  expect(walkIndex(0, 3, "previous")).toBe(0);
  expect(walkIndex(0, 3, "next")).toBe(1);
  expect(walkIndex(null, 0, "next")).toBeNull();
});

test("the status line names the position and the section", () => {
  expect(walkStatus(1, 4, "Goals")).toBe("Change 2 of 4: Goals");
  expect(walkStatus(null, 4, "Goals")).toBe("");
});
