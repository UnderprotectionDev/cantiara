import { describe, expect, test } from "vitest";

import {
  FILE_ATTACHMENT_QUOTA,
  FILE_ATTACHMENT_TYPE_RULES,
  FILE_ATTACHMENT_UI_LABELS,
  fileAttachmentFinalizeInputSchema,
  fileAttachmentLocationBindInputSchema,
  fileAttachmentMarkingInputSchema,
  fileAttachmentPreviewSchema,
  fileAttachmentScopeSchema,
} from "./file-attachments";
import { createWorkRpcMutationInputSchema } from "./work-lifecycle";

describe("File Attachments contract", () => {
  test("keeps the product labels and original-byte limits in one matrix", () => {
    expect(FILE_ATTACHMENT_UI_LABELS).toMatchObject({
      captions: "Captions",
      fileAttachment: "File Attachment",
      finalizing: "Finalizing",
      fullscreen: "Fullscreen",
      loop: "Loop",
      playbackSpeed: "Playback speed",
      preview: "Preview",
      retryPreview: "Retry preview",
      uploadNewVersion: "Upload new version",
    });
    expect(FILE_ATTACHMENT_TYPE_RULES.image.maxBytes).toBe(25 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.pdf.maxBytes).toBe(50 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.audio.maxBytes).toBe(100 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.video.maxBytes).toBe(250 * 1024 * 1024);
    expect(FILE_ATTACHMENT_QUOTA.maxBytes).toBe(25 * 1024 * 1024 * 1024);
    expect(FILE_ATTACHMENT_QUOTA.maxVersions).toBe(20_000);
    expect(FILE_ATTACHMENT_UI_LABELS).toMatchObject({
      arrow: "Arrow",
      bindAsOrigin: "Bind as origin",
      cancel: "Cancel",
      confirm: "Confirm",
      existingWork: "Existing Work",
      highlighter: "Highlighter",
      markingLayer: "Marking layer",
      markingSaveFailed: "Marking could not be saved. Try again.",
      markedSourceLocation: "Marked source location",
      newWork: "New Work",
      pen: "Pen",
      point: "Point",
      rectangle: "Rectangle",
      region: "Region",
      undo: "Undo",
    });
  });

  test("accepts only a Project or Personal Wiki ownership scope", () => {
    expect(
      fileAttachmentScopeSchema.parse({
        kind: "project",
        projectId: "project-1",
      }),
    ).toEqual({ kind: "project", projectId: "project-1" });
    expect(
      fileAttachmentScopeSchema.parse({
        kind: "personalWiki",
        personalWikiId: "account-1",
      }),
    ).toEqual({ kind: "personalWiki", personalWikiId: "account-1" });
    expect(() =>
      fileAttachmentScopeSchema.parse({ kind: "workspace", workspaceId: "1" }),
    ).toThrow();
  });

  test("distinguishes a new attachment from an explicit new version", () => {
    expect(
      fileAttachmentFinalizeInputSchema.parse({
        clientIdempotencyKey: "upload-1",
        fileName: "brief.pdf",
        declaredMimeType: "application/pdf",
        mode: "new",
        scope: { kind: "project", projectId: "project-1" },
        uploadId: "upload-object-1",
      }),
    ).toMatchObject({ mode: "new" });

    expect(
      fileAttachmentFinalizeInputSchema.parse({
        attachmentId: "attachment-1",
        baseRevision: 1,
        clientIdempotencyKey: "upload-2",
        fileName: "brief-v2.pdf",
        declaredMimeType: "application/pdf",
        mode: "new-version",
        uploadId: "upload-object-2",
      }),
    ).toMatchObject({ mode: "new-version" });
  });

  test("describes a ZIP as download-only without exposing an object URL", () => {
    const preview = fileAttachmentPreviewSchema.parse({
      attachmentId: "attachment-1",
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      kind: "download",
      status: "download-only",
      versionId: "version-1",
    });

    expect(preview).toMatchObject({
      kind: "download",
      status: "download-only",
    });
    expect(preview).not.toHaveProperty("objectKey");
    expect(preview).not.toHaveProperty("externalUrl");
  });

  test("pins marking geometry to an exact File Attachment version", () => {
    expect(
      fileAttachmentMarkingInputSchema.parse({
        attachmentId: "attachment-1",
        clientIdempotencyKey: "marking-1",
        geometry: {
          kind: "path",
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
          ],
        },
        tool: "highlighter",
        versionId: "version-1",
      }),
    ).toMatchObject({
      tool: "highlighter",
      versionId: "version-1",
    });
    expect(() =>
      fileAttachmentMarkingInputSchema.parse({
        attachmentId: "attachment-1",
        clientIdempotencyKey: "marking-2",
        geometry: {
          kind: "path",
          points: [{ x: 2, y: 0.4 }],
        },
        tool: "comment",
        versionId: "version-1",
      }),
    ).toThrow();
  });

  test("describes a previewed point bind without making the location a relation", () => {
    const input = fileAttachmentLocationBindInputSchema.parse({
      attachmentId: "attachment-1",
      baseRevision: 0,
      clientIdempotencyKey: "origin-1",
      location: { kind: "point", page: 2, x: 0.25, y: 0.75 },
      mode: "existing",
      previewId: "preview-1",
      versionId: "version-1",
      workId: "work-1",
    });

    expect(input).toMatchObject({
      location: { kind: "point", page: 2 },
      mode: "existing",
      versionId: "version-1",
    });
  });

  test("keeps File Attachment origin creation behind its validated seam", () => {
    expect(
      createWorkRpcMutationInputSchema.safeParse({
        baseRevision: 0,
        clientIdempotencyKey: "work-create-with-origin-1",
        originPosition: {
          componentId: "file-location:untrusted",
          location: { kind: "point", x: 0.5, y: 0.5 },
          ownerRecordId: "attachment-1",
          sourceVersion: "version-1",
        },
        projectId: "project-1",
        title: "Untrusted origin Work",
      }).success,
    ).toBe(false);
  });
});
