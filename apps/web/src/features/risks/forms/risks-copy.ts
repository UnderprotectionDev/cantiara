export const RISKS_COPY = {
	accepted: "Accepted",
	allRisks: "All Risks",
	createRisk: "Create Risk",
	description: "Description",
	impact: "Impact",
	mitigating: "Mitigating",
	noRisks: "No Risks yet.",
	occurred: "Occurred",
	open: "Open",
	probability: "Probability",
	rationale: "Rationale",
	resolved: "Resolved",
	responseMitigation: "Response/mitigation",
	risk: "Risk",
	setStatus: "Set status",
	title: "Title",
} as const;

export const RISK_STATUSES = [
	RISKS_COPY.open,
	RISKS_COPY.mitigating,
	RISKS_COPY.occurred,
	RISKS_COPY.resolved,
	RISKS_COPY.accepted,
] as const;
