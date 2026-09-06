import { expect, test } from "vitest";

import {
	SPEC_CHANGE_REVIEW_COPY,
	SPEC_CHANGE_REVIEW_STATUSES,
} from "./spec-change-review-copy";

const GIT_SOURCE_PATTERN = /gitSha|commitHash|workingTree|GitHub review/i;

test("English Spec Change Review labels stay Spec Change Review and Primary spec", () => {
	expect(SPEC_CHANGE_REVIEW_COPY.specChangeReview).toBe("Spec Change Review");
	expect(SPEC_CHANGE_REVIEW_COPY.primarySpec).toBe("Primary spec");
	expect(SPEC_CHANGE_REVIEW_COPY.version).toBe("Version");
	expect(SPEC_CHANGE_REVIEW_COPY.documentLevelCandidate).toBe(
		"Document-level candidate"
	);
	expect(SPEC_CHANGE_REVIEW_COPY.createFollowUpWork).toBe(
		"Create Follow-up Work"
	);
	expect(SPEC_CHANGE_REVIEW_COPY.followUpWork).toBe("Follow-up Work");
	expect(SPEC_CHANGE_REVIEW_COPY.preview).toBe("Preview");
	expect(SPEC_CHANGE_REVIEW_COPY.confirm).toBe("Confirm");
	expect(SPEC_CHANGE_REVIEW_COPY.waiting).toBe("Waiting");
	expect(SPEC_CHANGE_REVIEW_COPY.reviewed).toBe("Reviewed");
	expect(SPEC_CHANGE_REVIEW_COPY.notAffected).toBe("Not affected");
	expect([...SPEC_CHANGE_REVIEW_STATUSES]).toEqual([
		"Waiting",
		"Reviewed",
		"Not affected",
	]);
	expect(JSON.stringify(SPEC_CHANGE_REVIEW_COPY)).not.toMatch(
		GIT_SOURCE_PATTERN
	);
});
