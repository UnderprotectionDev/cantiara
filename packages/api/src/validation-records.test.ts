import { expect, test } from "vitest";
import {
  createProjectSourceRecordInputSchema,
  projectSourceRecordSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "./project-source-records";

const validationInput = {
  sourceType: "Validation Record",
  id: "validation-1",
  projectId: "project-1",
  title: "Export demand",
  method: "Interview founders",
  result: "Four need CSV",
  context: [],
  baseRevision: 0,
  clientIdempotencyKey: "create-validation",
};

test.each([
  "Planned Test Case",
  "Test Session",
  "Session Test",
  "Test Gap",
  "Research Session",
  "Feedback",
])("Validation Records cannot be opened or converted into %s", (sourceType) => {
  const { id, ...fields } = validationInput;
  const update = { ...fields, sourceId: id, baseRevision: 1 };
  expect(
    createProjectSourceRecordInputSchema.safeParse(validationInput).success,
  ).toBe(true);
  expect(updateProjectSourceRecordInputSchema.safeParse(update).success).toBe(
    true,
  );
  expect(
    createProjectSourceRecordInputSchema.safeParse({
      ...validationInput,
      sourceType,
    }).success,
  ).toBe(false);
  expect(
    updateProjectSourceRecordInputSchema.safeParse({ ...update, sourceType })
      .success,
  ).toBe(false);
  expect(
    updateProjectSourceRecordInputSchema.safeParse({
      ...update,
      context: [{ sourceType, sourceId: "counterpart-1" }],
    }).success,
  ).toBe(false);
});

test.each([
  "Passed",
  "Failed",
  "Reviewed",
  "Closed",
  "Planned",
  "Accepted",
  "Published",
])(
  "Validation Records cannot adopt the counterpart lifecycle state %s",
  (status) => {
    const transition = {
      sourceType: "Validation Record",
      sourceId: "validation-1",
      projectId: "project-1",
      baseRevision: 1,
      clientIdempotencyKey: "transition-validation",
    };
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...transition,
        status: "Archived",
      }).success,
    ).toBe(true);
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...transition,
        status,
      }).success,
    ).toBe(false);
  },
);

test("Validation Records cannot save test acceptance or release gate fields", () => {
  const { id, ...fields } = validationInput;
  const update = { ...fields, sourceId: id, baseRevision: 1 };
  for (const acceptance of [
    { testReportId: "test-report-1" },
    { releaseGate: true },
    { acceptance: "Accepted" },
  ]) {
    expect(
      createProjectSourceRecordInputSchema.safeParse({
        ...validationInput,
        ...acceptance,
      }).success,
    ).toBe(false);
    expect(
      updateProjectSourceRecordInputSchema.safeParse({
        ...update,
        ...acceptance,
      }).success,
    ).toBe(false);
  }
});

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
