export const UNCERTAINTY_COPY = {
	assumption: "Assumption",
	confirmed: "Confirmed",
	createAssumption: "Create Assumption",
	evidence: "Evidence",
	missingEvidence: "Missing evidence",
	noAssumptions: "No Assumptions yet.",
	noLongerApplicable: "No longer applicable",
	open: "Open",
	openQuestion: "Open Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	statement: "Statement",
} as const;

export const ASSUMPTION_LIVES = [
	UNCERTAINTY_COPY.open,
	UNCERTAINTY_COPY.confirmed,
	UNCERTAINTY_COPY.refuted,
	UNCERTAINTY_COPY.noLongerApplicable,
] as const;
