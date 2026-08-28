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
	expect(fileScopeFor("project-1")).toEqual({
		kind: "project",
		projectId: "project-1",
	});
	expect(fileScopeFor(null)).toEqual({ kind: "personal-wiki" });
});
