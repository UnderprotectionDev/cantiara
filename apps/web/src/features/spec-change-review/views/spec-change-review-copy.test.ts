import { expect, test } from "vitest";

import { SPEC_CHANGE_REVIEW_COPY } from "./spec-change-review-copy";

const GIT_SOURCE_PATTERN = /gitSha|commitHash|workingTree|GitHub review/i;

test("English Spec Change Review labels stay Spec Change Review and Primary spec", () => {
	expect(SPEC_CHANGE_REVIEW_COPY.specChangeReview).toBe("Spec Change Review");
	expect(SPEC_CHANGE_REVIEW_COPY.primarySpec).toBe("Primary spec");
	expect(SPEC_CHANGE_REVIEW_COPY.version).toBe("Version");
	expect(JSON.stringify(SPEC_CHANGE_REVIEW_COPY)).not.toMatch(
		GIT_SOURCE_PATTERN
	);
});
