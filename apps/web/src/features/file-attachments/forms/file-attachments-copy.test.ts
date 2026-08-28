import { expect, test } from "vitest";

import { FILE_ATTACHMENT_COPY, fileScopeFor } from "./file-attachments-copy";

test("English File Attachment labels stay File Attachment, Upload new version, and Finalizing", () => {
	expect(FILE_ATTACHMENT_COPY.fileAttachment).toBe("File Attachment");
	expect(FILE_ATTACHMENT_COPY.uploadNewVersion).toBe("Upload new version");
	expect(FILE_ATTACHMENT_COPY.finalizing).toBe("Finalizing");
	expect(fileScopeFor("project-1")).toEqual({
		kind: "project",
		projectId: "project-1",
	});
	expect(fileScopeFor(null)).toEqual({ kind: "personal-wiki" });
});
