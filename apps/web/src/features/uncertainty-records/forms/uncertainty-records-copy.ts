export const UNCERTAINTY_COPY = {
	answer: "Answer",
	answered: "Answered",
	assumption: "Assumption",
	confirmed: "Confirmed",
	context: "Context",
	createOpenQuestion: "Create Open Question",
	evidence: "Evidence",
	evidenceMissing: "Evidence missing",
	noLongerApplicable: "No longer applicable",
	noOpenQuestions: "No Open Questions yet.",
	open: "Open",
	openQuestion: "Open Question",
	question: "Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	title: "Title",
} as const;

export const OPEN_QUESTION_LIVES = [
	UNCERTAINTY_COPY.open,
	UNCERTAINTY_COPY.answered,
	UNCERTAINTY_COPY.noLongerApplicable,
] as const;
