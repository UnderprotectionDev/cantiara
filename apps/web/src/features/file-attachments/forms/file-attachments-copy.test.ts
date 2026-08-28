import { expect, test } from "vitest";

import {
	FILE_ATTACHMENT_COPY,
	filePreviewKind,
	fileScopeFor,
	galleryThumbnailSrc,
} from "./file-attachments-copy";

test("English File Attachment labels stay File Attachment, Upload new version, and Finalizing", () => {
	expect(FILE_ATTACHMENT_COPY.fileAttachment).toBe("File Attachment");
	expect(FILE_ATTACHMENT_COPY.uploadNewVersion).toBe("Upload new version");
	expect(FILE_ATTACHMENT_COPY.finalizing).toBe("Finalizing");
	expect(FILE_ATTACHMENT_COPY.unavailable).toBe("Unavailable");
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
	expect(fileScopeFor("project-1")).toEqual({
		kind: "project",
		projectId: "project-1",
	});
	expect(fileScopeFor(null)).toEqual({ kind: "personal-wiki" });
});
