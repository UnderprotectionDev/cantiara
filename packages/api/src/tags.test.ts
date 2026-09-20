import { describe, expect, test } from "vitest";

import {
  createTagInputSchema,
  createTagMarkdownExport,
  renameTagInputSchema,
  renameTagMutationInputSchema,
  TAG_RECORD_TYPE_OPTIONS,
  tagNameKey,
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
});
