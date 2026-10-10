import { expect, test } from "vitest";
import {
  createProjectSourceRecordInputSchema,
  projectSourceRecordSchema,
} from "./project-source-records";

test("Validation Records carries method, result and typed decision context", () => {
  const input = createProjectSourceRecordInputSchema.parse({
    sourceType: "Validation Record",
    id: "validation-1",
    projectId: "project-1",
    title: "Export demand",
    method: "Interview five founders",
    result: "Four need CSV",
    context: [{ sourceType: "Assumption", sourceId: "assumption-1" }],
    baseRevision: 0,
    clientIdempotencyKey: "create-validation",
  });
  const { baseRevision, clientIdempotencyKey, ...fields } = input;
  expect(baseRevision).toBe(0);
  expect(clientIdempotencyKey).toBe("create-validation");
  expect(
    projectSourceRecordSchema.parse({
      ...fields,
      createdAt: "2026-10-10T10:00:00.000Z",
      updatedAt: "2026-10-10T10:00:00.000Z",
      revision: 1,
      status: "Active",
    }).sourceType,
  ).toBe("Validation Record");
});

test("Validation Records rejects survey controls, automatic outcome fields and test context", () => {
  const input = {
    sourceType: "Validation Record",
    id: "validation-1",
    projectId: "project-1",
    title: "Export demand",
    method: "Interview founders",
    result: null,
    context: [],
    baseRevision: 0,
    clientIdempotencyKey: "create-validation",
  };
  expect(createProjectSourceRecordInputSchema.safeParse(input).success).toBe(
    true,
  );
  for (const fields of [
    { life: "Confirmed" },
    { survey: true },
    { voteEndsAt: "2026-10-10T10:00:00Z" },
    { context: [{ sourceType: "Test Session", sourceId: "test-1" }] },
  ]) {
    expect(
      createProjectSourceRecordInputSchema.safeParse({ ...input, ...fields })
        .success,
    ).toBe(false);
  }
});
