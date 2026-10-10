import { expect, test } from "vitest";
import { transitionProjectSourceRecordInputSchema } from "./project-source-records";

const command = {
  sourceType: "Assumption",
  projectId: "project-1",
  sourceId: "assumption-1",
  baseRevision: 1,
  clientIdempotencyKey: "transition-1",
};

test("Uncertainty Records accepts Confirmed and Refuted without evidence or rationale", () => {
  for (const life of ["Confirmed", "Refuted", "Open", "No longer applicable"]) {
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({ ...command, life })
        .success,
    ).toBe(true);
  }
});

test("Uncertainty Records permits optional exact evidence only on Confirmed and Refuted", () => {
  const documentEvidence = {
    documentId: "document-1",
    documentRevision: 2,
    selectionStart: 0,
    selectionEnd: 5,
    selectedText: "Proof",
  };
  for (const life of ["Confirmed", "Refuted"]) {
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...command,
        life,
        documentEvidence,
        rationale: "Observed directly.",
      }).success,
    ).toBe(true);
  }
  expect(
    transitionProjectSourceRecordInputSchema.safeParse({
      ...command,
      life: "No longer applicable",
      documentEvidence,
    }).success,
  ).toBe(false);
  expect(
    transitionProjectSourceRecordInputSchema.safeParse({
      ...command,
      life: "Answered",
    }).success,
  ).toBe(false);
});
