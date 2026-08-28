import { expect, test } from "vitest";

import { WORK_DRAFTS_COPY } from "./work-drafts-copy";

test("Work Drafts English UI is Draft, Drafts, Create, Last saved, and unsaved risk", () => {
	expect(WORK_DRAFTS_COPY.draft).toBe("Draft");
	expect(WORK_DRAFTS_COPY.drafts).toBe("Drafts");
	expect(WORK_DRAFTS_COPY.create).toBe("Create");
	expect(WORK_DRAFTS_COPY.lastSaved).toBe("Last saved");
	expect(WORK_DRAFTS_COPY.unsavedChangesMayBeLost).toBe(
		"Unsaved changes may be lost"
	);
	expect(WORK_DRAFTS_COPY.delete).toBe("Delete");
	expect(WORK_DRAFTS_COPY.resume).toBe("Resume");
	expect(WORK_DRAFTS_COPY.loading).toBe("Loading…");
	expect(WORK_DRAFTS_COPY.noDrafts).toBe("No drafts.");
});
