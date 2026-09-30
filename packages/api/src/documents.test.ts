import { describe, expect, it } from "vitest";

import {
  createDocumentInputSchema,
  createDocumentMutationInputSchema,
  documentInlineTagTokens,
  documentLiveDirectives,
  documentTypeSchema,
  previewDocumentHierarchy,
  renameDocumentInlineTag,
  resolveDocumentInlineTags,
  updateDocumentInputSchema,
  updateDocumentMutationInputSchema,
} from "./documents";

describe("Documents", () => {
  it("rejects wall skeletons and client-supplied skeleton content", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "create-skeleton",
      projectId: "project-1",
      skeleton: "Persona",
    };

    expect(createDocumentMutationInputSchema.safeParse(input).success).toBe(
      true,
    );
    for (const skeleton of ["Sitemap", "Customer Journey", "Personal Review"]) {
      expect(
        createDocumentMutationInputSchema.safeParse({ ...input, skeleton })
          .success,
      ).toBe(false);
    }
    for (const fields of [
      { body: "Sample persona" },
      { title: "Sample persona" },
      { type: "General" },
      { body: "Sample persona", title: "Sample persona", type: "Persona" },
    ]) {
      expect(
        createDocumentMutationInputSchema.safeParse({ ...input, ...fields })
          .success,
      ).toBe(false);
    }
  });

  it("keeps slash names flat and uses escaped brackets for names not representable as a bare token", () => {
    const renamed = renameDocumentInlineTag(
      "#release and `#release`",
      [{ tagId: "tag-1", name: "release", start: 0, end: 8 }],
      "tag-1",
      "Release planning",
    );
    expect(renamed.body).toBe("#[Release planning] and `#release`");
    expect(
      resolveDocumentInlineTags(renamed.body, [
        { id: "tag-1", name: "Release planning" },
      ]),
    ).toEqual([
      { tagId: "tag-1", name: "Release planning", start: 0, end: 19 },
    ]);
    expect(
      resolveDocumentInlineTags("#release/stable", [
        { id: "flat-tag", name: "release/stable" },
        { id: "other", name: "release" },
      ])[0]?.tagId,
    ).toBe("flat-tag");
  });
  it("resolves recognized tokens to existing Workspace identities without minting unknown tags", () => {
    expect(
      resolveDocumentInlineTags("#Release #unknown #release", [
        { id: "tag-1", name: "release" },
      ]),
    ).toEqual([
      { start: 0, end: 8, name: "Release", tagId: "tag-1" },
      { start: 18, end: 26, name: "release", tagId: "tag-1" },
    ]);
  });
  it("blocks a move whose descendants would exceed three Document levels without flattening", () => {
    const documents = [
      { id: "root", projectId: "project-1", parentDocumentId: null },
      { id: "child", projectId: "project-1", parentDocumentId: "root" },
      { id: "grandchild", projectId: "project-1", parentDocumentId: "child" },
      { id: "other", projectId: "project-1", parentDocumentId: null },
    ];
    expect(
      previewDocumentHierarchy(documents, {
        documentId: "root",
        parentDocumentId: "other",
        folder: null,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "Document hierarchy is limited to three levels.",
      descendantIds: ["child", "grandchild"],
    });
    expect(
      previewDocumentHierarchy(documents, {
        documentId: "grandchild",
        parentDocumentId: "root",
        folder: "Planning",
      }),
    ).toMatchObject({ allowed: true, depth: 2, descendantIds: [] });
    expect(documents).toContainEqual({
      id: "child",
      projectId: "project-1",
      parentDocumentId: "root",
    });
  });
  it("rejects cycles and cross-scope parents", () => {
    const documents = [
      { id: "root", projectId: "project-1", parentDocumentId: null },
      { id: "child", projectId: "project-1", parentDocumentId: "root" },
      { id: "foreign", projectId: "project-2", parentDocumentId: null },
    ];
    expect(
      previewDocumentHierarchy(documents, {
        documentId: "root",
        parentDocumentId: "child",
        folder: null,
      }).allowed,
    ).toBe(false);
    expect(
      previewDocumentHierarchy(documents, {
        documentId: "root",
        parentDocumentId: "foreign",
        folder: null,
      }).allowed,
    ).toBe(false);
  });
  it("recognizes Workspace tag tokens only in normal Markdown prose", () => {
    const body = [
      "# Planning #release",
      "- **#release** and #unknown",
      "`#code` https://example.test/#url \\#escaped",
      "[source](https://example.test/#destination)",
      "```md",
      "#fenced",
      "```",
      "    #indented",
    ].join("\n");
    expect(documentInlineTagTokens(body).map((token) => token.name)).toEqual([
      "release",
      "release",
      "unknown",
    ]);
  });
  it("keeps Markdown reference destinations unchanged when a tag is renamed", () => {
    const body = [
      "[docs]: #release",
      "[guide]: <#release>",
      "[continued]:",
      "  #release",
      "#release in prose",
    ].join("\n");
    const inlineTags = resolveDocumentInlineTags(body, [
      { id: "release-tag", name: "release" },
    ]);

    expect(inlineTags).toEqual([
      {
        start: body.lastIndexOf("#release"),
        end: body.lastIndexOf("#release") + "#release".length,
        name: "release",
        tagId: "release-tag",
      },
    ]);
    expect(
      renameDocumentInlineTag(
        body,
        inlineTags,
        "release-tag",
        "Release planning",
      ).body,
    ).toBe(
      "[docs]: #release\n[guide]: <#release>\n[continued]:\n  #release\n#[Release planning] in prose",
    );
  });
  it("scans malformed inline destinations without rescanning the remaining body", () => {
    const body = `${"](".repeat(20_000)}#release`;
    const startedAt = performance.now();

    expect(documentInlineTagTokens(body)).toEqual([
      { start: 40_000, end: 40_008, name: "release" },
    ]);
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
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
