import { expect, test } from "vitest";
import {
  createRelationFormSchema,
  resolveBlockerFormSchema,
} from "../relation-forms";

test("Blocked by swaps source and target of a Blocks relation", () => {
  const parsed = createRelationFormSchema("work-1").parse({
    relationKind: "Blocked by",
    targetWorkId: "work-2",
  });
  expect(parsed.kind).toBe("Blocks");
  expect(parsed.source).toEqual({ recordId: "work-2", recordType: "Work" });
  expect(parsed.target).toEqual({ recordId: "work-1", recordType: "Work" });
});

test("a plain relation keeps this Work as the source and needs a target", () => {
  const schema = createRelationFormSchema("work-1");
  const parsed = schema.parse({ relationKind: "Related", targetWorkId: "w2" });
  expect(parsed.source.recordId).toBe("work-1");
  expect(
    schema.safeParse({ relationKind: "Related", targetWorkId: "" }).success,
  ).toBe(false);
});

test("a blocker resolution note is trimmed and bounded", () => {
  expect(resolveBlockerFormSchema.parse({ note: "  done  " }).note).toBe(
    "done",
  );
  expect(
    resolveBlockerFormSchema.safeParse({ note: "x".repeat(1001) }).success,
  ).toBe(false);
});
