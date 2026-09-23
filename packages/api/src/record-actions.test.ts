import { describe, expect, test } from "vitest";

import {
  createRecordActionInputSchema,
  updateRecordActionInputSchema,
} from "./record-actions";

const startWork = {
  name: "Start Work",
  projectId: "project-1",
  steps: [
    { kind: "work-status", status: "In Progress" },
    { kind: "daily-focus-membership", operation: "add" },
  ],
};

describe("Record Actions definition contract", () => {
  test("accepts Start Work as one status and Daily Focus membership combination", () => {
    expect(createRecordActionInputSchema.safeParse(startWork).success).toBe(
      true,
    );
  });

  test("rejects open-ended steps, external calls, record creation, and multiple targets", () => {
    for (const forbiddenStep of [
      { kind: "script", source: "return true" },
      { kind: "http", url: "https://example.com" },
      { kind: "create-record", recordType: "Work" },
      { kind: "github-mutation", operation: "close-pull-request" },
    ]) {
      expect(
        createRecordActionInputSchema.safeParse({
          ...startWork,
          steps: [forbiddenStep],
        }).success,
      ).toBe(false);
    }

    expect(
      createRecordActionInputSchema.safeParse({
        ...startWork,
        targetRecordIds: ["work-1", "work-2"],
      }).success,
    ).toBe(false);
  });

  test("keeps Start Work semantics fixed and excludes terminal status writes", () => {
    expect(
      createRecordActionInputSchema.safeParse({
        ...startWork,
        steps: [
          { kind: "work-status", status: "Not Started" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }).success,
    ).toBe(false);
    expect(
      createRecordActionInputSchema.safeParse({
        ...startWork,
        name: "Close Work",
        steps: [{ kind: "work-status", status: "Closed" }],
      }).success,
    ).toBe(false);
  });

  test("rejects empty and conflicting step definitions", () => {
    expect(
      createRecordActionInputSchema.safeParse({ ...startWork, steps: [] })
        .success,
    ).toBe(false);
    expect(
      createRecordActionInputSchema.safeParse({
        ...startWork,
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "work-status", status: "Blocked" },
        ],
      }).success,
    ).toBe(false);
  });

  test("accepts a fixed value for an existing Custom field", () => {
    expect(
      createRecordActionInputSchema.safeParse({
        name: "Mark as ready",
        projectId: "project-1",
        steps: [
          {
            definitionId: "field-1",
            kind: "custom-field-value",
            operation: "set",
            value: { kind: "option", option: "Ready" },
          },
        ],
      }).success,
    ).toBe(true);
  });

  test("uses the same closed catalog when updating a definition", () => {
    expect(
      updateRecordActionInputSchema.safeParse({
        name: "Start Work",
        steps: startWork.steps,
      }).success,
    ).toBe(true);
    expect(
      updateRecordActionInputSchema.safeParse({
        name: "Start Work",
        steps: [{ kind: "run-command", command: "bun test" }],
      }).success,
    ).toBe(false);
  });
});
