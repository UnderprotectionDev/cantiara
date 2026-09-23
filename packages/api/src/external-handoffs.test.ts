import { describe, expect, test } from "vitest";

import {
  externalExecutionHandoffInputSchema,
  externalExecutionHandoffWorkSnapshotSchema,
  renderExternalExecutionHandoffPackage,
} from "./external-handoffs";

describe("External Execution Handoff package", () => {
  test("renders only the selected Work version and permitted GitHub identifiers", () => {
    const markdown = renderExternalExecutionHandoffPackage({
      handoffId: "handoff-1",
      input: {
        constraints: "Keep the existing API contract.",
        executor: "Local coding agent",
        expectedOutput: "A tested implementation.",
        githubContext: ["https://github.com/acme/cantiara/issues/166"],
        includeWork: true,
        purpose: "Implement external handoffs.",
        workId: "work-1",
      },
      producedAt: "2026-09-23T12:00:00.000Z",
      work: {
        description: "Create a frozen Markdown package.",
        id: "work-1",
        key: "CAN-166",
        revision: 4,
        status: "In Progress",
        targetDate: "2026-10-01",
        title: "Start Handoff",
        type: "Feature",
      },
    });

    expect(markdown).toContain("# External Execution Handoff");
    expect(markdown).toContain("Produced at: 2026-09-23T12:00:00.000Z");
    expect(markdown).toContain("Work: CAN-166");
    expect(markdown).toContain("Handoff ID: handoff-1");
    expect(markdown).toContain("Source of truth is in the app");
    expect(markdown).toContain("revision 4");
    expect(markdown).toContain("Create a frozen Markdown package.");
    expect(markdown).toContain("https://github.com/acme/cantiara/issues/166");
    expect(markdown).not.toContain("Unselected Decision");
    expect(markdown).not.toContain("secret_token");
  });

  test("rejects GitHub URLs carrying query strings or credentials", () => {
    expect(
      externalExecutionHandoffInputSchema.safeParse({
        constraints: "",
        executor: "Agent",
        expectedOutput: "Output",
        githubContext: [
          "https://github.com/acme/cantiara/issues/166?access_token=secret_token",
        ],
        includeWork: true,
        purpose: "Implement this work.",
        workId: "work-1",
      }).success,
    ).toBe(false);

    expect(
      externalExecutionHandoffInputSchema.safeParse({
        constraints: "",
        executor: "Agent",
        expectedOutput: "Output",
        githubContext: [
          "https://user:secret@github.com/acme/cantiara/issues/166",
        ],
        includeWork: true,
        purpose: "Implement this work.",
        workId: "work-1",
      }).success,
    ).toBe(false);
  });

  test("rejects unsupported source version selections in this slice", () => {
    expect(
      externalExecutionHandoffInputSchema.safeParse({
        constraints: "",
        documentVersions: [{ recordId: "document-1", revision: 1 }],
        executor: "Agent",
        expectedOutput: "Output",
        githubContext: [],
        includeWork: true,
        purpose: "Implement this work.",
        workId: "work-1",
      }).success,
    ).toBe(false);
  });

  test("omits the Work body when it is not selected and rejects extra source fields", () => {
    const markdown = renderExternalExecutionHandoffPackage({
      handoffId: "handoff-2",
      input: {
        constraints: "",
        executor: "Agent",
        expectedOutput: "Output",
        githubContext: [],
        includeWork: false,
        purpose: "Run without the Work body.",
        workId: "work-1",
      },
      producedAt: "2026-09-23T12:00:00.000Z",
      work: {
        description: "This selected Work body must stay out.",
        id: "work-1",
        key: "CAN-166",
        revision: 4,
        status: "In Progress",
        targetDate: null,
        title: "Private title not selected",
        type: "Feature",
      },
    });

    expect(markdown).toContain("- No Work version selected.");
    expect(markdown).not.toContain("This selected Work body must stay out.");
    expect(markdown).not.toContain("Private title not selected");
    expect(
      externalExecutionHandoffWorkSnapshotSchema.safeParse({
        description: null,
        id: "work-1",
        key: "CAN-166",
        revision: 4,
        secretToken: "secret_token",
        status: "In Progress",
        targetDate: null,
        title: "Start Handoff",
        type: "Feature",
      }).success,
    ).toBe(false);
  });
});
