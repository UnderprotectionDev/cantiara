export const FEEDBACK_COPY = {
	archived: "Archived",
	attachments: "Attachments",
	channel: "Channel",
	createFeedback: "Create Feedback",
	createFromSource: "Create from Source",
	feedback: "Feedback",
	link: "Link",
	new: "New",
	noFeedback: "No Feedback yet.",
	occurredAt: "Occurred at",
	originalMessage: "Original message",
	reviewed: "Reviewed",
	source: "Source",
	status: "Status",
} as const;

export const FEEDBACK_STATUSES = [
	FEEDBACK_COPY.new,
	FEEDBACK_COPY.reviewed,
	FEEDBACK_COPY.archived,
] as const;
