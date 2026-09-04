import { z } from "zod";

import {
	EVIDENCE_SOURCE_KINDS,
	EVIDENCE_TARGET_KINDS,
	type RecordKind,
} from "../../relations/server/relations-catalog";
import { originLocationSchema } from "../../relations/server/relations-model";

const LINE_SPLIT = /\r?\n/;

export const EVIDENCE_COPY = {
	bindAsEvidenceToExistingRecord: "Bind as evidence to existing record",
	convertToNewRecordAndBind: "Convert to new record and bind",
	newerVersionExists: "Newer version exists",
	openSourceRecord: "Open source record",
	originLocation: "Origin Location",
	preview: "Preview",
	sourceElementNoLongerExists: "Source element no longer exists",
	sourceStaysInPlace: "The source text stays in place.",
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

export const EVIDENCE_SOURCE_KIND = EVIDENCE_SOURCE_KINDS;
export const EVIDENCE_TARGET_KIND = EVIDENCE_TARGET_KINDS;

export const SURROUNDING_WINDOW = 80;

const evidenceSourceKindSchema = z.enum(EVIDENCE_SOURCE_KINDS);
const evidenceTargetKindSchema = z.enum(EVIDENCE_TARGET_KINDS);
const convertRecordKindSchema = z.enum(CONVERT_RECORD_KINDS);

export const textRangeSchema = z.object({
	end: z.number().int().nonnegative(),
	start: z.number().int().nonnegative(),
});

export type TextRange = z.infer<typeof textRangeSchema>;

export const evidenceOriginLocationViewSchema = z.object({
	componentId: z.string().min(1),
	missing: z.boolean(),
	missingLabel: z.literal(EVIDENCE_COPY.sourceElementNoLongerExists).nullable(),
	ownerId: z.string().min(1),
	ownerKind: z.string().min(1),
	sourceVersion: z.string().min(1),
});

export type EvidenceOriginLocationView = z.infer<
	typeof evidenceOriginLocationViewSchema
>;

export const evidenceBacklinkSchema = z.object({
	targetId: z.string().min(1),
	targetKind: z.string().min(1),
	targetTitle: z.string(),
});

export type EvidenceBacklink = z.infer<typeof evidenceBacklinkSchema>;

export const evidencePinViewSchema = z.object({
	backlinks: z.array(evidenceBacklinkSchema),
	contentAccess: z.enum(["open", "redacted"]),
	highlight: textRangeSchema,
	historicalBindExists: z.literal(true),
	id: z.string().min(1),
	newerVersionExists: z.boolean(),
	openSourceRecord: z.literal(EVIDENCE_COPY.openSourceRecord),
	originLocation: evidenceOriginLocationViewSchema.nullable(),
	rangeText: z.string(),
	relationId: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKind: evidenceSourceKindSchema,
	sourceStayedInPlace: z.literal(true),
	sourceVersionId: z.string().min(1),
	sourceVersionNumber: z.number().int().positive(),
	surroundingText: z.string(),
	targetId: z.string().min(1),
	targetKind: evidenceTargetKindSchema,
	targetTitle: z.string(),
	textRange: textRangeSchema,
	versionPinnedEvidence: z.literal(EVIDENCE_COPY.versionPinnedEvidence),
});

export type EvidencePinView = z.infer<typeof evidencePinViewSchema>;

export const bindEvidencePreviewSchema = z.object({
	fingerprint: z.string().min(1),
	label: z.literal(EVIDENCE_COPY.bindAsEvidenceToExistingRecord),
	originLocation: originLocationSchema.optional(),
	rangeText: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKind: evidenceSourceKindSchema,
	sourceStaysInPlace: z.literal(EVIDENCE_COPY.sourceStaysInPlace),
	sourceVersionId: z.string().min(1),
	sourceVersionNumber: z.number().int().positive(),
	surroundingText: z.string(),
	targetId: z.string().min(1),
	targetKind: evidenceTargetKindSchema,
	targetTitle: z.string(),
	textRange: textRangeSchema,
	type: z.literal("Evidence"),
	versionPinnedEvidence: z.literal(EVIDENCE_COPY.versionPinnedEvidence),
});

export type BindEvidencePreview = z.infer<typeof bindEvidencePreviewSchema>;

export const convertEvidencePreviewSchema = z.object({
	fingerprint: z.string().min(1),
	label: z.literal(EVIDENCE_COPY.convertToNewRecordAndBind),
	originLocation: originLocationSchema.optional(),
	projectId: z.string().min(1),
	rangeText: z.string().min(1),
	recordKind: convertRecordKindSchema,
	sourceId: z.string().min(1),
	sourceKind: evidenceSourceKindSchema,
	sourceStaysInPlace: z.literal(EVIDENCE_COPY.sourceStaysInPlace),
	sourceVersionId: z.string().min(1),
	sourceVersionNumber: z.number().int().positive(),
	surroundingText: z.string(),
	textRange: textRangeSchema,
	title: z.string().min(1),
	versionPinnedEvidence: z.literal(EVIDENCE_COPY.versionPinnedEvidence),
});

export type ConvertEvidencePreview = z.infer<
	typeof convertEvidencePreviewSchema
>;

export const rebindEvidencePreviewSchema = z.object({
	fingerprint: z.string().min(1),
	label: z.literal(EVIDENCE_COPY.newerVersionExists),
	newSourceVersionId: z.string().min(1),
	newSourceVersionNumber: z.number().int().positive(),
	pinId: z.string().min(1),
	rangeText: z.string().min(1),
	textRange: textRangeSchema,
});

export type RebindEvidencePreview = z.infer<typeof rebindEvidencePreviewSchema>;

const rangeFields = {
	rangeEnd: z.number().int().nonnegative().optional(),
	rangeStart: z.number().int().nonnegative().optional(),
	selectedText: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKind: evidenceSourceKindSchema,
	sourceVersionId: z.string().min(1),
};

export const previewBindEvidenceInputSchema = z.object({
	...rangeFields,
	originLocation: originLocationSchema.optional(),
	targetId: z.string().min(1),
	targetKind: evidenceTargetKindSchema,
	workspaceId: z.string().min(1),
});

export const bindEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		...rangeFields,
		originLocation: originLocationSchema.optional(),
		previewFingerprint: z.string().min(1),
		targetId: z.string().min(1),
		targetKind: evidenceTargetKindSchema,
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const previewConvertEvidenceInputSchema = z.object({
	...rangeFields,
	originLocation: originLocationSchema.optional(),
	projectId: z.string().min(1),
	recordKind: convertRecordKindSchema,
	title: z.string().optional(),
	workspaceId: z.string().min(1),
});

export const convertEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		...rangeFields,
		originLocation: originLocationSchema.optional(),
		previewFingerprint: z.string().min(1),
		projectId: z.string().min(1),
		recordKind: convertRecordKindSchema,
		title: z.string().optional(),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const previewRebindEvidenceInputSchema = z.object({
	pinId: z.string().min(1),
	rangeEnd: z.number().int().nonnegative().optional(),
	rangeStart: z.number().int().nonnegative().optional(),
	selectedText: z.string().min(1).optional(),
	workspaceId: z.string().min(1),
});

export const rebindEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		pinId: z.string().min(1),
		previewFingerprint: z.string().min(1),
		rangeEnd: z.number().int().nonnegative().optional(),
		rangeStart: z.number().int().nonnegative().optional(),
		selectedText: z.string().min(1).optional(),
	}),
	previewAcknowledged: z.boolean().optional(),
	workspaceId: z.string().min(1),
});

export const redactEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		pinId: z.string().min(1),
	}),
	workspaceId: z.string().min(1),
});

export const EVIDENCE_REJECTION_REASONS = [
	"invalid-command",
	"preview-required",
	"preview-mismatch",
	"source-not-found",
	"target-not-found",
	"ends-not-allowed",
	"range-not-in-version",
	"pin-not-found",
	"unsupported-record-type",
	"no-match-in-candidate-version",
	"silent-retarget",
] as const;

export type EvidenceRejectionReason =
	(typeof EVIDENCE_REJECTION_REASONS)[number];

export type PreviewBindOutcome =
	| { preview: BindEvidencePreview; status: "ok" }
	| { reason: EvidenceRejectionReason; status: "rejected" };

export type PreviewConvertOutcome =
	| { preview: ConvertEvidencePreview; status: "ok" }
	| { reason: EvidenceRejectionReason; status: "rejected" };

export type PreviewRebindOutcome =
	| { preview: RebindEvidencePreview; status: "ok" }
	| { reason: EvidenceRejectionReason; status: "rejected" };

export type EvidenceWriteOutcome =
	| { pin: EvidencePinView; status: "committed" }
	| { pin: EvidencePinView; status: "replayed" }
	| {
			pin: EvidencePinView;
			record: { id: string; kind: ConvertRecordKind; title: string };
			status: "committed";
	  }
	| {
			pin: EvidencePinView;
			record: { id: string; kind: ConvertRecordKind; title: string };
			status: "replayed";
	  }
	| { conflict: "Conflict"; status: "conflict" }
	| { reason: EvidenceRejectionReason; status: "rejected" };

export function convertKindToRecordKind(
	kind: ConvertRecordKind
): Extract<
	RecordKind,
	"Work" | "Decision" | "Risk" | "Assumption" | "Question"
> {
	if (kind === "Open Question") {
		return "Question";
	}
	return kind;
}

export function firstLineTitle(text: string): string {
	const line = text.split(LINE_SPLIT)[0]?.trim() ?? "";
	return line.length > 0 ? line.slice(0, 120) : "Untitled";
}
