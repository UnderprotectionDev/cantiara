import { expect, test } from "vitest";
import { valueChainSourceHref } from "../value-chain-links";

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
