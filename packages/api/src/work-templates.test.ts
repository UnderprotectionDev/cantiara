import { describe, expect, test } from "vitest";

import {
  createWorkTemplateInputSchema,
  resolveWorkTemplateDates,
} from "./work-templates";

describe("Work Templates contract", () => {
  test("defines reusable Project start context and resolves relative dates from the Work creation day", () => {
    const definition = createWorkTemplateInputSchema.parse({
      checklist: [{ id: "check-release-notes", text: "Draft release notes" }],
      customFieldDefaults: [
        {
          definitionId: "field-release-readiness",
          value: { kind: "option", option: "Ready" },
        },
      ],
      descriptionSkeleton: "## Outcome\n\n## Notes",
      name: "Release preparation",
      projectId: "project-1",
      relativeDates: {
        plannedStart: { offsetDays: 2 },
        target: { offsetDays: 10 },
      },
      type: "Task",
    });

    expect(
      resolveWorkTemplateDates({
        createDate: "2026-09-22",
        relativeDates: definition.relativeDates,
      }),
    ).toEqual({
      plannedStartDate: "2026-09-24",
      targetDate: "2026-10-02",
    });
  });

  test.each([
    ["current status", { status: "In Progress" }],
    ["closure result", { closureResult: "Completed" }],
    ["relations", { relations: ["work-2"] }],
    ["history", { history: [{ changedAt: "2026-09-22" }] }],
    ["absolute target date", { targetDate: "2026-10-02" }],
    ["absolute planned start date", { plannedStartDate: "2026-09-24" }],
  ])("refuses forbidden %s payload", (_label, forbidden) => {
    expect(
      createWorkTemplateInputSchema.safeParse({
        checklist: [],
        customFieldDefaults: [],
        descriptionSkeleton: null,
        name: "Release preparation",
        projectId: "project-1",
        relativeDates: {},
        type: "Task",
        ...forbidden,
      }).success,
    ).toBe(false);
  });

  test("refuses absolute Date custom-field defaults and Document placeholder syntax", () => {
    const base = {
      checklist: [],
      name: "Release preparation",
      projectId: "project-1",
      relativeDates: {},
      type: "Task",
    } as const;

    expect(
      createWorkTemplateInputSchema.safeParse({
        ...base,
        customFieldDefaults: [
          {
            definitionId: "field-date",
            value: { date: "2026-10-02", kind: "date" },
          },
        ],
        descriptionSkeleton: null,
      }).success,
    ).toBe(false);
    expect(
      createWorkTemplateInputSchema.safeParse({
        ...base,
        customFieldDefaults: [],
        descriptionSkeleton: "Owner: {{owner}}",
      }).success,
    ).toBe(false);
  });

  test("fails closed when the creation day is not a real calendar date", () => {
    expect(() =>
      resolveWorkTemplateDates({
        createDate: "2026-02-31",
        relativeDates: { target: { offsetDays: 0 } },
      }),
    ).toThrow("Date must be a real calendar day.");
  });
});
