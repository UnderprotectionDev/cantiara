import { describe, expect, test } from "vitest";

import { WORK_DEFAULT_TYPE, workTypeSchema } from "./work-lifecycle";
import {
  createWorkTemplateInputSchema,
  duplicateWorkInputSchema,
  resolveWorkTemplateDates,
  workDuplicatePreviewInputSchema,
  workTemplateSchema,
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

  test("keeps the template revision aligned with the database floor of 1", () => {
    const output = {
      checklist: [],
      createdAt: "2026-09-22T09:00:00.000Z",
      customFieldDefaults: [],
      descriptionSkeleton: null,
      id: "template-1",
      name: "Release preparation",
      projectId: "project-1",
      relativeDates: {},
      revision: 1,
      trashedAt: null,
      type: "Task",
      updatedAt: "2026-09-22T09:00:00.000Z",
    };

    expect(workTemplateSchema.safeParse(output).success).toBe(true);
    expect(
      workTemplateSchema.safeParse({ ...output, revision: 0 }).success,
    ).toBe(false);
  });

  test("requires a preview-backed one-off copy selection without accepting lifecycle fields", () => {
    expect(
      workDuplicatePreviewInputSchema.parse({ sourceWorkId: "work-1" }),
    ).toEqual({ sourceWorkId: "work-1" });

    const command = {
      baseRevision: 0,
      clientIdempotencyKey: "duplicate-work-1",
      previewId: "preview-1",
      selectedCustomFieldIds: ["field-readiness"],
      selectedFields: ["title", "type", "description", "checklist"],
      sourceWorkId: "work-1",
    } as const;
    expect(duplicateWorkInputSchema.safeParse(command).success).toBe(true);

    for (const forbidden of [
      { status: "In Progress" },
      { targetDate: "2026-10-02" },
      { closureResult: "Completed" },
      { relationIds: ["relation-1"] },
      { planningMemberships: ["Board"] },
      { templateId: "template-1" },
    ]) {
      expect(
        duplicateWorkInputSchema.safeParse({ ...command, ...forbidden })
          .success,
      ).toBe(false);
    }
  });

  test("falls back to the shared default Work type when Type is not copied", () => {
    expect(workTypeSchema.safeParse(WORK_DEFAULT_TYPE).success).toBe(true);
  });
});
