import { expect, test } from "vitest";

import {
	filePreviewKind,
	galleryThumbnailPathFromFile,
	galleryThumbnailSrc,
	previewFromVersion,
} from "./file-preview-presentation";

test("Gallery list never uses the original content path as a thumbnail", () => {
	expect(
		galleryThumbnailSrc({
			contentPath: "/api/file-attachments/a/versions/b",
			galleryThumbnailPath: "/api/file-attachments/a/versions/b",
		})
	).toBeNull();
	expect(
		galleryThumbnailSrc({
			contentPath: "/api/file-attachments/a/versions/b",
			galleryThumbnailPath:
				"/api/file-attachments/a/versions/b/thumbnails/small",
		})
	).toBe("/api/file-attachments/a/versions/b/thumbnails/small");
	expect(filePreviewKind({ kind: "zip", status: "ready", unpack: false })).toBe(
		"download"
	);
	expect(
		filePreviewKind({ kind: "image", status: "unavailable", unpack: false })
	).toBe("unavailable");
});

test("listing a File Attachment does not crash when preview is missing", () => {
	expect(() =>
		galleryThumbnailPathFromFile({
			currentVersion: {},
		})
	).not.toThrow();
	expect(
		galleryThumbnailPathFromFile({
			currentVersion: {},
		})
	).toBeNull();
	expect(previewFromVersion({}).galleryThumbnailPath).toBeNull();
	expect(previewFromVersion({}).status).toBe("unavailable");
});
