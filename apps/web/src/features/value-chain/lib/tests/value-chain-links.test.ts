import { expect, test } from "vitest";
import {
  valueChainGapActions,
  valueChainSourceHref,
} from "../value-chain-links";

test("opens each record at its owner surface", () => {
  expect(valueChainSourceHref("p 1", { id: "w1", type: "Work" })).toBe(
    "/projects/p%201#work-w1",
  );
  expect(valueChainSourceHref("p", { id: "d1", type: "Decision" })).toBe(
    "/projects/p#source-decision-d1",
  );
  expect(valueChainSourceHref("p", { id: "t1", type: "Test" })).toContain(
    "planned-test-case-t1",
  );
});

test("a record without an owner surface has no link", () => {
  expect(
    valueChainSourceHref("p", { id: "x", type: "Other record" }),
  ).toBeNull();
});

test("a gap leads into the owning feature by navigation only", () => {
  const work = { id: "w1", type: "Work" } as const;
  expect(
    valueChainGapActions("p", { from: work, missing: "Decision" }),
  ).toEqual({
    choose: "/projects/p#work-relations-w1",
    start: "/projects/p#project-area-decisions",
  });
  expect(
    valueChainGapActions("p", {
      from: { id: "g1", type: "Project Goal" },
      missing: "Work",
    })?.choose,
  ).toBe("/projects/p#project-goal-g1");
  expect(
    valueChainGapActions("p", { from: work, missing: "Evidence" }),
  ).toBeNull();
});
