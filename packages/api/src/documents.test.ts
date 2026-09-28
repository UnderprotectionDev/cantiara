import { describe, expect, it } from "vitest";

import {
  createDocumentInputSchema,
  documentTypeSchema,
  updateDocumentInputSchema,
} from "./documents";

describe("Documents", () => {
  it("accepts one Markdown body containing a table, fenced code, Mermaid, and LaTeX", () => {
    const body = [
      "| Name | Value |",
      "| --- | --- |",
      "| x | 1 |",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "```mermaid",
      "graph TD; A-->B;",
      "```",
      "",
      "$$x^2$$",
    ].join("\n");

    expect(
      createDocumentInputSchema.parse({
        projectId: "project-1",
        title: "Architecture",
        body,
        type: "Spec",
      }).body,
    ).toBe(body);
  });

  it("accepts only the six Document types and permits a type-only change", () => {
    expect(documentTypeSchema.options).toEqual([
      "General",
      "PRD",
      "Plan",
      "Spec",
      "Research Note",
      "Persona",
    ]);
    expect(
      updateDocumentInputSchema.parse({
        documentId: "document-1",
        baseRevision: 0,
        type: "Plan",
      }),
    ).toMatchObject({ type: "Plan" });
    expect(documentTypeSchema.safeParse("Wiki").success).toBe(false);
  });
});
