export const SPEC_CHANGE_REVIEW_COPY = {
	documentLevelCandidate: "Document-level candidate",
	notAffected: "Not affected",
	note: "Note",
	primarySpec: "Primary spec",
	reviewed: "Reviewed",
	specChangeReview: "Spec Change Review",
	version: "Version",
	waiting: "Waiting",
	why: "Why",
} as const;

export const SPEC_CHANGE_REVIEW_STATUSES = [
	SPEC_CHANGE_REVIEW_COPY.waiting,
	SPEC_CHANGE_REVIEW_COPY.reviewed,
	SPEC_CHANGE_REVIEW_COPY.notAffected,
] as const;
