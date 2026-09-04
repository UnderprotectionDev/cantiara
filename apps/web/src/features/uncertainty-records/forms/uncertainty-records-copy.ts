export const UNCERTAINTY_COPY = {
	answer: "Answer",
	answered: "Answered",
	assumption: "Assumption",
	confirmed: "Confirmed",
	context: "Context",
	createAssumption: "Create Assumption",
	createOpenQuestion: "Create Open Question",
	evidence: "Evidence",
	evidenceMissing: "Evidence missing",
	missingEvidence: "Missing evidence",
	noAssumptions: "No Assumptions yet.",
	noLongerApplicable: "No longer applicable",
	noOpenQuestions: "No Open Questions yet.",
	open: "Open",
	openQuestion: "Open Question",
	question: "Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	statement: "Statement",
	title: "Title",
} as const;

export const ASSUMPTION_LIVES = [
	UNCERTAINTY_COPY.open,
	UNCERTAINTY_COPY.confirmed,
	UNCERTAINTY_COPY.refuted,
	UNCERTAINTY_COPY.noLongerApplicable,
] as const;

export const OPEN_QUESTION_LIVES = [
	UNCERTAINTY_COPY.open,
	UNCERTAINTY_COPY.answered,
	UNCERTAINTY_COPY.noLongerApplicable,
] as const;
