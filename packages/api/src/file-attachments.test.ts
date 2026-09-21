import { describe, expect, test } from "vitest";

import {
  FILE_ATTACHMENT_QUOTA,
  FILE_ATTACHMENT_TYPE_RULES,
  FILE_ATTACHMENT_UI_LABELS,
  fileAttachmentFinalizeInputSchema,
  fileAttachmentPreviewSchema,
  fileAttachmentScopeSchema,
} from "./file-attachments";

describe("File Attachments contract", () => {
  test("keeps the product labels and original-byte limits in one matrix", () => {
    expect(FILE_ATTACHMENT_UI_LABELS).toMatchObject({
      fileAttachment: "File Attachment",
      finalizing: "Finalizing",
      uploadNewVersion: "Upload new version",
    });
    expect(FILE_ATTACHMENT_TYPE_RULES.image.maxBytes).toBe(25 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.pdf.maxBytes).toBe(50 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.audio.maxBytes).toBe(100 * 1024 * 1024);
    expect(FILE_ATTACHMENT_TYPE_RULES.video.maxBytes).toBe(250 * 1024 * 1024);
    expect(FILE_ATTACHMENT_QUOTA.maxBytes).toBe(25 * 1024 * 1024 * 1024);
    expect(FILE_ATTACHMENT_QUOTA.maxVersions).toBe(20_000);
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
});
