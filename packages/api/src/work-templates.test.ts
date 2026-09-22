import { describe, expect, test } from "vitest";

import {
  createWorkTemplateInputSchema,
  duplicateWorkMutationInputSchema,
  instantiateWorkTemplateMutationInputSchema,
  previewDuplicateWorkInputSchema,
  resolveWorkTemplateDates,
  workTemplateSchema,
} from "./work-templates";

describe("Work Templates contract", () => {
  test("accepts only the command data needed to create independent Work", () => {
    const command = {
      baseRevision: 3,
      clientIdempotencyKey: "instantiate-release-1",
      createDate: "2026-09-22",
      templateId: "template-1",
      title: "Prepare the October release",
    };

    expect(instantiateWorkTemplateMutationInputSchema.parse(command)).toEqual(
      command,
    );
    expect(
      instantiateWorkTemplateMutationInputSchema.safeParse({
        ...command,
        status: "Closed",
      }).success,
    ).toBe(false);
  });

  test("accepts only the start-context selection needed for a one-off copy", () => {
    const command = {
      baseRevision: 2,
      clientIdempotencyKey: "duplicate-work-1",
      customFieldDefinitionIds: ["field-1"],
      sourceWorkId: "work-1",
    };

    expect(duplicateWorkMutationInputSchema.parse(command)).toEqual(command);
    expect(
      duplicateWorkMutationInputSchema.safeParse({
        ...command,
        targetDate: "2026-10-02",
      }).success,
    ).toBe(false);
    expect(
      duplicateWorkMutationInputSchema.safeParse({
        clientIdempotencyKey: "duplicate-work-1",
        sourceWorkId: "work-1",
      }).success,
    ).toBe(false);
    expect(
      previewDuplicateWorkInputSchema.parse({ sourceWorkId: "work-1" }),
    ).toEqual({ sourceWorkId: "work-1" });
  });

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
});
