import { describe, expect, test } from "vitest";

import { workDraftFormSchema } from "./work-drafts";

describe("Work Drafts", () => {
  test("keeps Project Custom Field values as form state without copying definitions", () => {
    const parsed = workDraftFormSchema.parse({
      checklist: [],
      customFieldValues: [
        {
          definitionId: "field-shipped",
          payload: { boolean: false, kind: "boolean" },
        },
      ],
      description: null,
      projectId: "project-1",
      title: "Verify payment flow",
      type: "Task",
    });

    expect(parsed.customFieldValues).toEqual([
      {
        definitionId: "field-shipped",
        payload: { boolean: false, kind: "boolean" },
      },
    ]);
    expect(parsed).not.toHaveProperty("customFieldDefinitions");
  });

  test("does not accept Reappear date on Work Draft", () => {
    expect(
      workDraftFormSchema.safeParse({
        projectId: "project-1",
        reappearDate: "2026-10-01",
        title: "Review deferred payment flow",
        type: "Task",
      }).success,
    ).toBe(false);
  });
});
