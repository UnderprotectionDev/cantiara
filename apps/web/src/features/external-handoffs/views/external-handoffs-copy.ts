export const EXTERNAL_HANDOFFS_COPY = {
	addSelectedVersion: "Add selected version",
	body: "Body",
	constraints: "Constraints",
	executor: "Executor",
	expectedOutput: "Expected output",
	externalExecutionHandoff: "External Execution Handoff",
	github: "GitHub",
	goingPackage: "Going package",
	handoff: "Handoff",
	includeThisWork: "Include this Work",
	kind: "Kind",
	newPackageVersion: "New package version",
	open: "Open",
	packageVersion: "Package version",
	producedAt: "Produced at",
	purpose: "Purpose",
	recordId: "Record",
	removeSelectedVersion: "Remove selected version",
	selectedVersions: "Selected versions",
	sourceOfTruth: "Source of truth is in the app",
	startHandoff: "Start Handoff",
	title: "Title",
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

export function presentHandoffHistoryKind(kind: string): string {
	if (kind === "started") {
		return EXTERNAL_HANDOFFS_COPY.startHandoff;
	}
	return EXTERNAL_HANDOFFS_COPY.goingPackage;
}

export const SELECTED_VERSION_KINDS = [
	"Work",
	"Document",
	"Decision",
	"Risk",
	"Open Question",
	"Source",
] as const;
