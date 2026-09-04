export const FEEDBACK_COPY = {
	archived: "Archived",
	attachments: "Attachments",
	channel: "Channel",
	company: "Company",
	contact: "Contact",
	convertToWork: "Convert to Work",
	createFeedback: "Create Feedback",
	createFromSource: "Create from Source",
	description: "Description",
	feedback: "Feedback",
	link: "Link",
	new: "New",
	noFeedback: "No Feedback yet.",
	occurredAt: "Occurred at",
	origin: "Origin",
	originalMessage: "Original message",
	project: "Project",
	reviewed: "Reviewed",
	source: "Source",
	status: "Status",
	title: "Title",
} as const;

export const FEEDBACK_STATUSES = [
	FEEDBACK_COPY.new,
	FEEDBACK_COPY.reviewed,
	FEEDBACK_COPY.archived,
] as const;
