import { describe, expect, it } from "vitest";

import {
  createDocumentInputSchema,
  createDocumentMutationInputSchema,
  documentLiveDirectives,
  documentTypeSchema,
  updateDocumentInputSchema,
  updateDocumentMutationInputSchema,
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
        type: "Plan",
      }),
    ).toMatchObject({ type: "Plan" });
    expect(documentTypeSchema.safeParse("Wiki").success).toBe(false);
  });

  it("requires a human mutation envelope for create and update commands", () => {
    expect(
      createDocumentMutationInputSchema.safeParse({
        body: "",
        projectId: "project-1",
        title: "Architecture",
        type: "General",
      }).success,
    ).toBe(false);
    expect(
      createDocumentMutationInputSchema.parse({
        baseRevision: 0,
        body: "",
        clientIdempotencyKey: "create-document-1",
        projectId: "project-1",
        title: "Architecture",
        type: "General",
      }),
    ).toMatchObject({
      baseRevision: 0,
      clientIdempotencyKey: "create-document-1",
    });
    expect(
      updateDocumentMutationInputSchema.safeParse({
        baseRevision: 1,
        clientIdempotencyKey: "update-document-1",
        documentId: "document-1",
        body: "Updated",
      }).success,
    ).toBe(true);
    expect(
      updateDocumentMutationInputSchema.safeParse({
        baseRevision: 1,
        documentId: "document-1",
        body: "Updated",
      }).success,
    ).toBe(false);
  });

  it("keeps live source identity and ignores directives inside fenced code", () => {
    expect(
      documentLiveDirectives(
        ':::live-collection{viewId="view-1"}\n:::live-diagram{diagramId="diagram-1" viewId="view-2"}\n```md\n:::live-collection{viewId="example"}\n```',
      ),
    ).toMatchObject([
      { id: "view-1", kind: "Smart Collection" },
      { id: "diagram-1", kind: "Technical Diagram", viewId: "view-2" },
    ]);
  });
});
