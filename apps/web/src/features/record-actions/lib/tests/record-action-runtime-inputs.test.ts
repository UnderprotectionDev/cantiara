import type { RecordAction } from "@cantiara/api/record-actions";
import { describe, expect, test } from "vitest";

import { recordActionRuntimeInputsFormSchema } from "../record-action-runtime-inputs";

const action: RecordAction = {
  createdAt: "2026-09-22T09:00:00.000Z",
  id: "action-1",
  name: "Start Work",
  projectId: "project-1",
  revision: 1,
  steps: [
    { kind: "work-status", status: "In Progress" },
    {
      definitionId: "field-1",
      kind: "custom-field-value",
      operation: "set",
      value: { kind: "runtime-input" },
    },
    { inputId: "related-record", kind: "related-work", operation: "add" },
  ],
  trashedAt: null,
  updatedAt: "2026-09-22T09:00:00.000Z",
};

describe("Record Action runtime input form schema", () => {
  test("requires every runtime Custom field value and related Work", () => {
    const schema = recordActionRuntimeInputsFormSchema(action);
    expect(
      schema.safeParse({ customFieldValues: {}, relations: {} }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        customFieldValues: { "field-1": { kind: "option", option: "Ready" } },
        relations: { "related-record": undefined },
      }).success,
    ).toBe(false);
  });

  test("maps the draft to the preview command inputs", () => {
    const parsed = recordActionRuntimeInputsFormSchema(action).safeParse({
      customFieldValues: { "field-1": { kind: "option", option: "Ready" } },
      relations: { "related-record": "work-2" },
    });
    expect(parsed.success && parsed.data).toEqual({
      customFieldValues: { "field-1": { kind: "option", option: "Ready" } },
      relations: {
        "related-record": { recordId: "work-2", recordType: "Work" },
      },
    });
  });
});
