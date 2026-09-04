import { expect, test } from "vitest";

import { FEEDBACK_COPY, FEEDBACK_STATUSES } from "./feedback-copy";

const SOCIAL_OR_PUBLIC =
	/public form|comment thread|upvote|like|vote|requester|two-way/i;
const SOURCE_LIFE =
	/approvedVersionNumber|candidate snapshot|source check|recheck source|Save as new Source version/i;

test("English Feedback labels stay Feedback, New, Reviewed, and Archived", () => {
	expect(FEEDBACK_COPY.feedback).toBe("Feedback");
	expect(FEEDBACK_COPY.originalMessage).toBe("Original message");
	expect(FEEDBACK_COPY.channel).toBe("Channel");
	expect(FEEDBACK_COPY.occurredAt).toBe("Occurred at");
	expect(FEEDBACK_COPY.createFeedback).toBe("Create Feedback");
	expect(FEEDBACK_COPY.convertToWork).toBe("Convert to Work");
	expect(FEEDBACK_COPY.contact).toBe("Contact");
	expect(FEEDBACK_COPY.company).toBe("Company");
	expect(FEEDBACK_COPY.evidenceQuality).toBe("Evidence quality");
	expect(FEEDBACK_COPY.reportedProblem).toBe("Reported problem");
	expect(FEEDBACK_COPY.unknown).toBe("Unknown");
	expect(FEEDBACK_COPY.founderInterpretation).toBe("Founder interpretation");
	expect(FEEDBACK_COPY.evidenceRole).toBe("Evidence Role");
	expect(FEEDBACK_COPY.followUp).toBe("Follow up");
	expect(FEEDBACK_COPY.followedUp).toBe("Followed up");
	expect(FEEDBACK_COPY.outcomeVerified).toBe("Outcome verified");
	expect(FEEDBACK_COPY.bindAsEvidenceToExistingRecord).toBe(
		"Bind as evidence to existing record"
	);
	expect(FEEDBACK_COPY.new).toBe("New");
	expect(FEEDBACK_COPY.reviewed).toBe("Reviewed");
	expect(FEEDBACK_COPY.archived).toBe("Archived");
	expect(FEEDBACK_STATUSES).toEqual(["New", "Reviewed", "Archived"]);
	expect(JSON.stringify(FEEDBACK_COPY)).not.toMatch(SOCIAL_OR_PUBLIC);
	expect(JSON.stringify(FEEDBACK_COPY)).not.toMatch(SOURCE_LIFE);
});
