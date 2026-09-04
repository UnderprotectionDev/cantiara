export const EVIDENCE_COPY = {
	bindAsEvidenceToExistingRecord: "Bind as evidence to existing record",
	convertToNewRecordAndBind: "Convert to new record and bind",
	newerVersionExists: "Newer version exists",
	openSourceRecord: "Open source record",
	originLocation: "Origin Location",
	preview: "Preview",
	sourceElementNoLongerExists: "Source element no longer exists",
	sourceStaysInPlace: "The source text stays in place.",
	target: "Target",
	versionPinnedEvidence: "Version-pinned evidence",
} as const;

export const CONVERT_RECORD_KINDS = [
	"Work",
	"Decision",
	"Risk",
	"Assumption",
	"Open Question",
] as const;

export type ConvertRecordKind = (typeof CONVERT_RECORD_KINDS)[number];
