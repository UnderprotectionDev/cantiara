import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createLiveCardBlock,
} from "@cantiara/api/wireframe-document";
import { expect, test } from "vitest";
import { paintBlock } from "../paint";

const card = createLiveCardBlock(
  "card-1",
  { x: 10, y: 10 },
  { recordId: "work-1", recordType: "Work" },
);

test("a live card paints the live record title and marks a gone record broken", () => {
  expect(
    paintBlock(card, undefined, { state: "resolved", title: "Ship pricing" })
      .label,
  ).toBe("Work: Ship pricing");
  const broken = paintBlock(card, undefined, { state: "broken", title: null });
  expect(broken.broken).toBe(true);
  expect(broken.label).toBe("Work unavailable");
});

test("moving a live card changes only its placement", () => {
  const document = { ...createEmptyWireframeDocument(), blocks: [card] };
  const moved = applyWireframeTransaction(document, [
    { blockId: "card-1", type: "moveBlock", x: 200, y: 120 },
  ]);
  expect(moved.blocks[0]).toEqual({ ...card, x: 200, y: 120 });
});
