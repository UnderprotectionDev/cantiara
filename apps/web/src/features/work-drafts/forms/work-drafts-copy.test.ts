import { expect, test } from "vitest";

import { WORK_DRAFTS_COPY } from "./work-drafts-copy";

test("Work Drafts English UI is Draft and Drafts", () => {
	expect(WORK_DRAFTS_COPY.draft).toBe("Draft");
	expect(WORK_DRAFTS_COPY.drafts).toBe("Drafts");
	expect(WORK_DRAFTS_COPY.delete).toBe("Delete");
	expect(WORK_DRAFTS_COPY.resume).toBe("Resume");
	expect(WORK_DRAFTS_COPY.noDrafts).toBe("No drafts.");
});
