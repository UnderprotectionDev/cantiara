import { describe, expect, test } from "vitest";

import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
  createCustomFieldInputSchema,
} from "./custom-fields";

describe("Project Custom Fields seam", () => {
  test("exposes the closed six-type catalog and supported record bindings", () => {
    expect(CUSTOM_FIELD_TYPE_OPTIONS).toEqual([
      "Text",
      "Number",
      "Boolean",
      "Date",
      "Single select",
      "Multi select",
    ]);
    expect(CUSTOM_FIELD_RECORD_TYPE_OPTIONS).toEqual([
      "Work",
      "Feedback",
      "User Research Session",
      "Risk",
      "Assumption",
      "Decision",
      "Test Handoff",
      "Test Session",
      "Planned Test Scenario",
      "Test Gap",
      "Production Incident",
      "Milestone",
      "Project Release",
    ]);
    expect(CUSTOM_FIELD_TYPE_OPTIONS).not.toContain("Lookup");
    expect(CUSTOM_FIELD_TYPE_OPTIONS).not.toContain("Formula");
    expect(CUSTOM_FIELD_RECORD_TYPE_OPTIONS).not.toContain("Session Test");
    expect(CUSTOM_FIELD_RECORD_TYPE_OPTIONS).not.toContain("Test assessment");
    expect(CUSTOM_FIELD_RECORD_TYPE_OPTIONS).not.toContain("Markdown body");
    expect(CUSTOM_FIELD_RECORD_TYPE_OPTIONS).not.toContain("Raw attachment");
  });

  test.each(CUSTOM_FIELD_TYPE_OPTIONS)(
    "accepts a %s field bound to Work",
    (type) => {
      const options =
        type === "Single select" || type === "Multi select"
          ? ["Ready", "Later"]
          : undefined;

      expect(
        createCustomFieldInputSchema.parse({
          name: "Release readiness",
          options,
          projectId: "project-1",
          recordTypes: ["Work"],
          type,
        }),
      ).toMatchObject({
        name: "Release readiness",
        options: options ?? [],
        projectId: "project-1",
        recordTypes: ["Work"],
        type,
      });
    },
  );

  test.each(["Lookup", "Formula"])("rejects a %s field", (type) => {
    expect(() =>
      createCustomFieldInputSchema.parse({
        name: "Derived value",
        projectId: "project-1",
        recordTypes: ["Work"],
        type,
      }),
    ).toThrow();
  });

  test.each([
    "Session Test",
    "Test assessment",
    "Markdown body",
    "Raw attachment",
  ])("rejects %s as a record binding", (recordType) => {
    expect(() =>
      createCustomFieldInputSchema.parse({
        name: "Unsupported binding",
        projectId: "project-1",
        recordTypes: [recordType],
        type: "Text",
      }),
    ).toThrow();
  });

  test("requires options only for select fields and keeps bindings unique", () => {
    expect(() =>
      createCustomFieldInputSchema.parse({
        name: "Status",
        projectId: "project-1",
        recordTypes: ["Work"],
        type: "Single select",
      }),
    ).toThrow();

    expect(() =>
      createCustomFieldInputSchema.parse({
        name: "Title",
        options: ["One option"],
        projectId: "project-1",
        recordTypes: ["Work"],
        type: "Text",
      }),
    ).toThrow();

    expect(() =>
      createCustomFieldInputSchema.parse({
        name: "Duplicate binding",
        projectId: "project-1",
        recordTypes: ["Work", "Work"],
        type: "Text",
      }),
    ).toThrow();
  });
});
