export const EVIDENCE_COPY = {
	bindAsEvidenceToExistingRecord: "Bind as evidence to existing record",
	contradicting: "Contradicting",
	convertToNewRecordAndBind: "Convert to new record and bind",
	evidenceFlow: "Evidence Flow",
	evidenceRole: "Evidence Role",
	founderInterpretation: "Founder interpretation",
	inconclusive: "Inconclusive",
	newerVersionExists: "Newer version exists",
	openSourceRecord: "Open source record",
	originLocation: "Origin Location",
	preview: "Preview",
	providesContext: "Provides context",
	sourceElementNoLongerExists: "Source element no longer exists",
	sourceStaysInPlace: "The source text stays in place.",
	supporting: "Supporting",
	unspecified: "Unspecified",
	versionPinnedEvidence: "Version-pinned evidence",
} as const;

export const EVIDENCE_ROLES = [
	EVIDENCE_COPY.supporting,
	EVIDENCE_COPY.contradicting,
	EVIDENCE_COPY.providesContext,
	EVIDENCE_COPY.inconclusive,
	EVIDENCE_COPY.unspecified,
] as const;

export type EvidenceRole = (typeof EVIDENCE_ROLES)[number];

export const CONVERT_RECORD_KINDS = [
	"Work",
	"Decision",
	"Risk",
	"Assumption",
	"Open Question",
] as const;

export type ConvertRecordKind = (typeof CONVERT_RECORD_KINDS)[number];

export const EVIDENCE_SOURCE_KINDS = [
	"Source",
	"Document",
	"Diagram Version",
	"Feedback",
	"User Research Session",
	"Experiment/Validation",
	"Session Test",
	"File Attachment",
] as const;

export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KINDS)[number];

export type EvidenceTargetKind =
	| "Work"
	| "Decision"
	| "Risk"
	| "Assumption"
	| "Question";

export type EvidenceFlowTargetKind = "Work" | "Decision" | "Assumption";

export function convertKindToEvidenceTargetKind(
	kind: ConvertRecordKind
): EvidenceTargetKind {
	if (kind === "Open Question") {
		return "Question";
	}
	return kind;
}
