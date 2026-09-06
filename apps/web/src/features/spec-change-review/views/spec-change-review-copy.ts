export const SPEC_CHANGE_REVIEW_COPY = {
	confirm: "Confirm",
	createFollowUpWork: "Create Follow-up Work",
	documentLevelCandidate: "Document-level candidate",
	followUpWork: "Follow-up Work",
	notAffected: "Not affected",
	note: "Note",
	preview: "Preview",
	primarySpec: "Primary spec",
	project: "Project",
	reviewed: "Reviewed",
	specChangeReview: "Spec Change Review",
	startingStatus: "Not Started",
	version: "Version",
	waiting: "Waiting",
	why: "Why",
} as const;

export const SPEC_CHANGE_REVIEW_STATUSES = [
	SPEC_CHANGE_REVIEW_COPY.waiting,
	SPEC_CHANGE_REVIEW_COPY.reviewed,
	SPEC_CHANGE_REVIEW_COPY.notAffected,
] as const;

export function isSpecChangeReviewStatus(
	value: string
): value is (typeof SPEC_CHANGE_REVIEW_STATUSES)[number] {
	return (SPEC_CHANGE_REVIEW_STATUSES as readonly string[]).includes(value);
}
