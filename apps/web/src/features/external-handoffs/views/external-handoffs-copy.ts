export const EXTERNAL_HANDOFFS_COPY = {
	addFollowUpWork: "Add follow-up Work",
	addProposedRelation: "Add proposed relation",
	addSelectedVersion: "Add selected version",
	body: "Body",
	changedAssumptions: "Changed assumptions",
	confirm: "Confirm",
	constraints: "Constraints",
	executor: "Executor",
	executorSummary: "Executor summary",
	expectedOutput: "Expected output",
	externalExecutionHandoff: "External Execution Handoff",
	followUpWork: "Follow-up Work",
	github: "GitHub",
	goingPackage: "Going package",
	handoff: "Handoff",
	includeThisWork: "Include this Work",
	kind: "Kind",
	open: "Open",
	openQuestions: "Open questions",
	permittedExternalLinks: "Permitted external links",
	producedAt: "Produced at",
	producedEvidence: "Produced evidence",
	purpose: "Purpose",
	reconcile: "Reconcile",
	reconciled: "Reconciled",
	recordId: "Record",
	recordReturn: "Record return",
	reject: "Reject",
	related: "Related",
	removeFollowUpWork: "Remove follow-up Work",
	removeProposedRelation: "Remove proposed relation",
	removeSelectedVersion: "Remove selected version",
	resultReturned: "Result returned",
	selectedVersions: "Selected versions",
	sourceOfTruth: "Source of truth is in the app",
	startHandoff: "Start Handoff",
	title: "Title",
	toWork: "Related Work",
	versionId: "Version",
} as const;

export function presentHandoffCard(handoff: {
	goingPackage: { producedAt: string };
	purpose: string;
	status: string;
}): {
	producedAt: string;
	status: string;
	title: string;
} {
	const purpose = handoff.purpose.trim();
	return {
		producedAt: handoff.goingPackage.producedAt,
		status: handoff.status,
		title:
			purpose === ""
				? EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff
				: purpose,
	};
}

export const SELECTED_VERSION_KINDS = [
	"Work",
	"Document",
	"Decision",
	"Risk",
	"Open Question",
	"Source",
] as const;
