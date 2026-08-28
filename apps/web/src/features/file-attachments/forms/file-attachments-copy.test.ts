import { expect, test } from "vitest";

import { FILE_ATTACHMENT_COPY, fileScopeFor } from "./file-attachments-copy";

test("English File Attachment labels stay File Attachment, Upload new version, Finalizing, and Unavailable", () => {
	expect(FILE_ATTACHMENT_COPY.fileAttachment).toBe("File Attachment");
	expect(FILE_ATTACHMENT_COPY.uploadNewVersion).toBe("Upload new version");
	expect(FILE_ATTACHMENT_COPY.finalizing).toBe("Finalizing");
	expect(FILE_ATTACHMENT_COPY.unavailable).toBe("Unavailable");
	expect(FILE_ATTACHMENT_COPY.previous).toBe("Previous");
	expect(FILE_ATTACHMENT_COPY.next).toBe("Next");
	expect(FILE_ATTACHMENT_COPY.speed).toBe("Speed");
	expect(FILE_ATTACHMENT_COPY.fullscreen).toBe("Fullscreen");
	expect(FILE_ATTACHMENT_COPY.loop).toBe("Loop");
	expect(FILE_ATTACHMENT_COPY.chooseFile).toBe("Choose file");
	expect(FILE_ATTACHMENT_COPY.noFileSelected).toBe("No file selected");
	expect(FILE_ATTACHMENT_COPY.versions).toBe("Versions");
	expect(FILE_ATTACHMENT_COPY.selectFileAttachment).toBe(
		"Select a File Attachment"
	);
	expect(FILE_ATTACHMENT_COPY.pen).toBe("Pen");
	expect(FILE_ATTACHMENT_COPY.highlighter).toBe("Highlighter");
	expect(FILE_ATTACHMENT_COPY.arrow).toBe("Arrow");
	expect(FILE_ATTACHMENT_COPY.rectangle).toBe("Rectangle");
	expect(FILE_ATTACHMENT_COPY.originLocation).toBe("Origin Location");
	expect(FILE_ATTACHMENT_COPY.markingLayer).toBe("Marking layer");
	expect(FILE_ATTACHMENT_COPY.sourceVisual).toBe("Source visual");
	expect(FILE_ATTACHMENT_COPY.point).toBe("Point");
	expect(FILE_ATTACHMENT_COPY.region).toBe("Region");
	expect(FILE_ATTACHMENT_COPY.newWork).toBe("New Work");
	expect(FILE_ATTACHMENT_COPY.existingWork).toBe("Existing Work");
	expect(FILE_ATTACHMENT_COPY.confirm).toBe("Confirm");
	expect(FILE_ATTACHMENT_COPY.previewRequired).toBe(
		"Preview the Origin Location bind before confirming."
	);
	expect(FILE_ATTACHMENT_COPY.workRequiresProject).toBe(
		"Origin Location binds to Work in a Project."
	);
	expect(fileScopeFor("project-1")).toEqual({
		kind: "project",
		projectId: "project-1",
	});
	expect(fileScopeFor(null)).toEqual({ kind: "personal-wiki" });
});
