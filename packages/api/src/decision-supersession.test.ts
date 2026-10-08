import { expect, test } from "vitest";
import {
  decisionSupersessionCommandSchema,
  decisionSupersessionSelectionSchema,
} from "./decision-supersession";

const selection = {
  projectId: "project",
  successorId: "new",
  predecessorIds: ["old"],
  operation: "supersede",
  rationale: null,
};
test("Decisions rejects self-links, repeated predecessors, and partial supersession commands", () => {
  expect(decisionSupersessionSelectionSchema.safeParse(selection).success).toBe(
    true,
  );
  expect(
    decisionSupersessionSelectionSchema.safeParse({
      ...selection,
      predecessorIds: ["new"],
    }).success,
  ).toBe(false);
  expect(
    decisionSupersessionSelectionSchema.safeParse({
      ...selection,
      predecessorIds: ["old", "old"],
    }).success,
  ).toBe(false);
  expect(
    decisionSupersessionSelectionSchema.safeParse({
      ...selection,
      predecessorIds: [],
    }).success,
  ).toBe(false);
  expect(decisionSupersessionCommandSchema.safeParse(selection).success).toBe(
    false,
  );
  expect(
    decisionSupersessionCommandSchema.safeParse({
      ...selection,
      baseRevision: 0,
      clientIdempotencyKey: "confirm",
      previewFingerprint: "preview",
    }).success,
  ).toBe(true);
});
