import type {
  FileAttachment,
  FileAttachmentPreview,
} from "@cantiara/api/file-attachments";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { fileAttachmentAssetURL } from "../../lib/file-attachment-assets";
import { FileAttachmentPreviewView } from "./file-attachment-preview";

const attachment: FileAttachment = {
  createdAt: "2026-09-21T10:00:00.000Z",
  currentVersion: {
    byteSize: 2048,
    contentHash: "a".repeat(64),
    createdAt: "2026-09-21T10:00:00.000Z",
    detectedMimeType: "image/png",
    extension: ".png",
    fileName: "photo.png",
    id: "version-1",
    mimeType: "image/png",
    number: 1,
    preview: "image",
  },
  id: "attachment-1",
  lifecycleStatus: "Active",
  name: "photo.png",
  revision: 0,
  scope: { kind: "project", projectId: "project-1" },
  updatedAt: "2026-09-21T10:00:00.000Z",
};

const noopDownload = () => undefined;

function renderPreview(
  preview: FileAttachmentPreview,
  overrides: Partial<Parameters<typeof FileAttachmentPreviewView>[0]> = {},
) {
  return renderToStaticMarkup(
    <FileAttachmentPreviewView
      assetStatus="ready"
      assetURL="blob:http://localhost/file-attachment"
      attachment={attachment}
      onDownload={noopDownload}
      preview={preview}
      {...overrides}
    />,
  );
}

describe("File Attachment preview surface", () => {
  test("keeps preview assets inside the protected product boundary", () => {
    expect(
      fileAttachmentAssetURL(
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=medium",
      ).pathname,
    ).toBe("/api/file-attachments/attachment-1/versions/version-1/asset");
    expect(() =>
      fileAttachmentAssetURL("https://r2.example/file-attachment.webp"),
    ).toThrow("product-controlled");
    expect(() => fileAttachmentAssetURL("/r2/file-attachment.webp")).toThrow(
      "product-controlled",
    );
  });

  test("renders an isolated image preview from the Gallery derivative", () => {
    const markup = renderPreview({
      attachmentId: attachment.id,
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      gallery: {
        mediumPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=medium",
        smallPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=small",
      },
      kind: "image",
      previewPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      status: "available",
      versionId: attachment.currentVersion.id,
    });

    expect(markup).toContain('data-file-attachment-preview="image"');
    expect(markup).toContain('alt="photo.png"');
    expect(markup).toContain("Download");
    expect(markup).not.toContain("r2");
  });

  test("renders user-started media controls without autoplay", () => {
    const markup = renderPreview(
      {
        attachmentId: attachment.id,
        downloadPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        kind: "video",
        playback: {
          autoplay: false,
          fullscreen: true,
          loop: "optional",
          speeds: [0.75, 1, 1.25, 1.5, 2],
          userInitiated: true,
        },
        previewPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        status: "available",
        versionId: attachment.currentVersion.id,
      },
      { assetURL: "blob:http://localhost/video" },
    );

    expect(markup).toContain("<video");
    expect(markup).toContain("controls");
    expect(markup).toContain("Playback speed");
    expect(markup).toContain("Fullscreen");
    expect(markup).toContain("Loop");
    expect(markup).not.toContain("autoplay");
  });

  test("renders bounded CSV and safe text content as text", () => {
    const csvMarkup = renderPreview({
      attachmentId: attachment.id,
      csv: {
        headers: ["name", "value"],
        rows: [["alpha", "1"]],
        truncated: true,
      },
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      kind: "csv",
      previewPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      status: "available",
      versionId: attachment.currentVersion.id,
    });
    const textMarkup = renderPreview({
      attachmentId: attachment.id,
      downloadPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      kind: "text",
      previewPath:
        "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
      status: "available",
      text: { content: "<script>safe text</script>", truncated: false },
      versionId: attachment.currentVersion.id,
    });

    expect(csvMarkup).toContain("alpha");
    expect(csvMarkup).toContain("Preview is truncated");
    expect(textMarkup).toContain("&lt;script&gt;safe text&lt;/script&gt;");
    expect(textMarkup).not.toContain("<script>safe text</script>");
  });

  test("shows paged PDF canvases and keeps a failed preview downloadable", () => {
    const pdfMarkup = renderPreview(
      {
        attachmentId: attachment.id,
        downloadPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        kind: "pdf",
        pageCount: 2,
        previewPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        status: "available",
        versionId: attachment.currentVersion.id,
      },
      { assetURL: "blob:http://localhost/document" },
    );
    const unavailableMarkup = renderPreview(
      {
        attachmentId: attachment.id,
        downloadPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        failure: {
          attempts: 3,
          code: "processing-failed",
          message: "The preview could not be generated.",
          retryable: false,
        },
        fallback: "Unavailable",
        kind: "image",
        status: "unavailable",
        versionId: attachment.currentVersion.id,
      },
      { onRetry: () => undefined },
    );
    const assetUnavailableMarkup = renderPreview(
      {
        attachmentId: attachment.id,
        downloadPath:
          "/api/file-attachments/attachment-1/versions/version-1/asset?variant=original",
        kind: "image",
        status: "available",
        versionId: attachment.currentVersion.id,
      },
      {
        assetStatus: "error",
        assetURL: undefined,
        onRetry: () => undefined,
      },
    );

    expect(pdfMarkup).toContain("PDF page 1 of 2");
    expect(pdfMarkup).toContain("PDF page 2 of 2");
    expect(unavailableMarkup).toContain("Unavailable");
    expect(unavailableMarkup).not.toContain("Retry preview");
    expect(unavailableMarkup).toContain("Download");
    expect(assetUnavailableMarkup).toContain("Retry preview");
  });
});
