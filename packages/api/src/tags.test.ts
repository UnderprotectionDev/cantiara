import { describe, expect, test } from "vitest";

import {
  createTagInputSchema,
  createTagMarkdownExport,
  createTagMarkdownImportPreview,
  renameTagCommandSchema,
  renameTagInputSchema,
  renameTagMutationInputSchema,
  TAG_RECORD_TYPE_OPTIONS,
  tagIdentityFilterSchema,
  tagNameKey,
  tagRecordsInputSchema,
  undoTagRenameInputSchema,
} from "./tags";

describe("Tags seam", () => {
  test("keeps one flat Workspace name and treats slash as text", () => {
    expect(TAG_RECORD_TYPE_OPTIONS).toEqual(["Work"]);
    expect(createTagInputSchema.parse({ name: "  roadmap/next  " })).toEqual({
      name: "roadmap/next",
    });
    expect(tagNameKey("Roadmap/Next")).toBe("roadmap/next");
  });

  test("rejects an empty tag name", () => {
    expect(() => createTagInputSchema.parse({ name: "   " })).toThrow();
  });

  test("filters records by Tag identity instead of a visible name", () => {
    expect(tagIdentityFilterSchema.parse({ tagId: "tag-1" })).toEqual({
      tagId: "tag-1",
    });
    expect(
      tagRecordsInputSchema.parse({
        projectId: "project-1",
        tagId: "tag-1",
      }),
    ).toEqual({ projectId: "project-1", tagId: "tag-1" });
    expect(() =>
      tagIdentityFilterSchema.parse({ name: "launch/next" }),
    ).toThrow();
    expect(() =>
      tagRecordsInputSchema.parse({
        name: "launch/next",
        projectId: "project-1",
      }),
    ).toThrow();
  });

  test("accepts an identity-preserving rename and an optional revision guard", () => {
    expect(
      renameTagInputSchema.parse({
        expectedRevision: 4,
        name: "  launch/next  ",
        tagId: "tag-1",
      }),
    ).toEqual({
      expectedRevision: 4,
      name: "launch/next",
      tagId: "tag-1",
    });
  });

  test("requires the shared human mutation envelope for a rename command", () => {
    expect(
      renameTagMutationInputSchema.parse({
        baseRevision: 0,
        clientIdempotencyKey: "rename-1",
        name: "launch/next",
        tagId: "tag-1",
      }),
    ).toMatchObject({
      baseRevision: 0,
      clientIdempotencyKey: "rename-1",
    });
  });

  test("keeps the feature-level revision guard out of the rename RPC command", () => {
    expect(() =>
      renameTagCommandSchema.parse({
        expectedRevision: 4,
        name: "launch/next",
        tagId: "tag-1",
      }),
    ).toThrow();
  });

  test("requires a receipt and current base revision for rename Undo", () => {
    expect(
      undoTagRenameInputSchema.parse({
        baseRevision: 1,
        clientIdempotencyKey: "undo-rename-1",
        receiptId: "receipt-1",
        tagId: "tag-1",
      }),
    ).toMatchObject({ receiptId: "receipt-1", tagId: "tag-1" });
  });

  test("keeps Markdown text and carries the canonical Tag identity in the manifest", () => {
    const markdown = "# Launch\n\n#roadmap/next";

    expect(
      createTagMarkdownExport(markdown, [
        {
          id: "tag-1",
          name: "roadmap/next",
        },
      ]),
    ).toEqual({
      markdown,
      manifest: {
        tags: [{ id: "tag-1", name: "roadmap/next" }],
        version: 1,
      },
    });
  });

  test("previews import against identity or visible name without minting copies", () => {
    const preview = createTagMarkdownImportPreview(
      {
        tags: [
          { id: "tag-1", name: "roadmap/next" },
          { id: "exported-existing", name: "customer" },
          { id: "exported-name-match", name: "Launch/Next" },
          { id: "exported-new", name: "support/next" },
          { id: "exported-new-copy", name: "Support/Next" },
        ],
        version: 1,
      },
      [
        {
          id: "tag-1",
          name: "launch/next",
        },
        {
          id: "exported-existing",
          name: "customer",
        },
      ],
    );

    expect(preview).toEqual([
      {
        sourceTags: [{ id: "exported-existing", name: "customer" }],
        resolution: { kind: "existing", tagId: "exported-existing" },
      },
      {
        sourceTags: [
          { id: "tag-1", name: "roadmap/next" },
          { id: "exported-name-match", name: "Launch/Next" },
        ],
        resolution: { kind: "existing", tagId: "tag-1" },
      },
      {
        sourceTags: [
          { id: "exported-new", name: "support/next" },
          { id: "exported-new-copy", name: "Support/Next" },
        ],
        resolution: { kind: "new", name: "support/next" },
      },
    ]);
  });
});
