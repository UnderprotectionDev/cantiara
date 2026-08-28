import { expect, test } from "vitest";

import {
	filePreviewKind,
	galleryThumbnailSrc,
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
