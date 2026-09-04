import { z } from "zod";

export const SOURCES_COPY = {
	accessedAt: "Accessed at",
	address: "Address",
	approvedVersion: "Approved version",
	capturedContent: "Captured content",
	createSource: "Create Source",
	excerpt: "Excerpt",
	externalId: "External id",
	externalRecordType: "External record type",
	historicalSnapshot: "Historical snapshot",
	keepCurrentVersion: "Keep current version",
	liveExternalSource: "Live external source",
	livePreview: "Live preview",
	loadPlayer: "Load player",
	newerSourceVersionExists: "Newer Source version exists",
	noMatchInCandidateVersion: "No match in candidate version",
	noSources: "No Sources yet.",
	provider: "Provider",
	rebindToNewVersion: "Rebind to new version",
	recheckSource: "Recheck source",
	reviewedKeepCurrentVersion: "Reviewed; keep current version",
	saveAsNewSourceVersion: "Save as new Source version",
	saveAsSource: "Save as Source",
	showAddress: "Show address",
	showDescription: "Show description",
	showImage: "Show image",
	source: "Source",
	sourceCheck: "Source Check",
	thirdPartyFetchWillOccur: "A third-party server will be contacted.",
	thirdPartyWarning: "This loads third-party YouTube content.",
	title: "Title",
	versions: "Versions",
	youtubeUnavailable: "This video cannot be shown.",
} as const;

export const SOURCE_VERSION_IN_USE_SIGNAL_ID = "source-version-in-use" as const;

export const SOURCE_VERSION_IN_USE_SIGNAL_SECTION = "Action Required" as const;

export const SOURCE_CHECK_DISPOSITION = {
	kept: "kept",
	open: "open",
	saved: "saved",
} as const;

export const SOURCE_CHECK_FAILURE = {
	auth: "auth",
	blocked: "blocked",
	credentials: "credentials",
	deleted: "deleted",
	deniedTarget: "denied-target",
	oversized: "oversized",
	unsupported: "unsupported",
} as const;

export const SOURCE_EVIDENCE_REVIEW = {
	keep: "keep",
	rebind: "rebind",
} as const;

export const SOURCES_COUNTERPARTS = {
	autoImpact: false,
	backgroundPoll: false,
	batchRebind: false,
} as const;

export const SOURCE_PROVIDER = {
	github: "GitHub",
	youtube: "YouTube",
} as const;

export const SOURCE_EXTERNAL_RECORD_TYPE = {
	issue: "Issue",
	pullRequest: "Pull request",
	repository: "Repository",
	video: "Video",
} as const;

export const sourceVersionViewSchema = z.object({
	accessedAt: z.string(),
	capturedContent: z.string(),
	excerpt: z.string(),
	externalId: z.string().nullable(),
	externalRecordType: z.string().nullable(),
	id: z.string().min(1),
	provider: z.string().nullable(),
	title: z.string(),
	url: z.string(),
	versionNumber: z.number().int().positive(),
});

export type SourceVersionView = z.infer<typeof sourceVersionViewSchema>;

export const sourceViewSchema = z.object({
	accessedAt: z.string(),
	approvedVersionNumber: z.number().int().positive(),
	capturedContent: z.string(),
	excerpt: z.string(),
	externalId: z.string().nullable(),
	externalRecordType: z.string().nullable(),
	id: z.string().min(1),
	projectId: z.string().min(1),
	provider: z.string().nullable(),
	recordKind: z.literal(SOURCES_COPY.source),
	revision: z.number().int().positive(),
	title: z.string(),
	url: z.string(),
	versions: z.array(sourceVersionViewSchema),
});

export type SourceView = z.infer<typeof sourceViewSchema>;

const optionalOriginField = z.string().trim().min(1).optional();

export const createSourcePayloadSchema = z.object({
	accessedAt: z.string().optional(),
	capturedContent: z.string(),
	excerpt: z.string().optional(),
	externalId: optionalOriginField,
	externalRecordType: optionalOriginField,
	projectId: z.string().min(1),
	provider: optionalOriginField,
	title: z.string().min(1),
	url: z.string().trim().min(1),
});

export type CreateSourcePayload = z.infer<typeof createSourcePayloadSchema>;

export const createSourceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createSourcePayloadSchema,
});

export type CreateSourceCommand = z.infer<typeof createSourceCommandSchema>;

export const saveSourceVersionPayloadSchema = z.object({
	accessedAt: z.string().optional(),
	capturedContent: z.string(),
	excerpt: z.string().optional(),
	externalId: optionalOriginField,
	externalRecordType: optionalOriginField,
	provider: optionalOriginField,
	sourceId: z.string().min(1),
	title: z.string().min(1),
	url: z.string().trim().min(1),
});

export const saveSourceVersionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: saveSourceVersionPayloadSchema,
});

export type SaveSourceVersionCommand = z.infer<
	typeof saveSourceVersionCommandSchema
>;

export const sourceWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		source: sourceViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		source: sourceViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"source-not-found",
			"project-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type SourceWriteOutcome = z.infer<typeof sourceWriteOutcomeSchema>;

export const sourceCheckCandidateSchema = z.object({
	accessedAt: z.string(),
	capturedContent: z.string(),
	title: z.string(),
	url: z.string(),
});

export const sourceCheckViewSchema = z.object({
	actorId: z.string().min(1),
	candidate: sourceCheckCandidateSchema.nullable(),
	comparedApprovedVersionNumber: z.number().int().positive(),
	contentType: z.string().nullable(),
	disposition: z.enum([
		SOURCE_CHECK_DISPOSITION.kept,
		SOURCE_CHECK_DISPOSITION.open,
		SOURCE_CHECK_DISPOSITION.saved,
	]),
	failureReason: z.string().nullable(),
	finalUrl: z.string().nullable(),
	fingerprint: z.string().nullable(),
	httpResult: z.string(),
	id: z.string().min(1),
	presentsOldContentAsCurrent: z.literal(false),
	sourceId: z.string().min(1),
	startedAt: z.string(),
	startUrl: z.string(),
});

export type SourceCheckView = z.infer<typeof sourceCheckViewSchema>;

export const sourceRecheckPreviewSchema = z.object({
	approvedVersionNumber: z.number().int().positive(),
	startUrl: z.string(),
	thirdPartyFetchWillOccur: z.literal(true),
});

export type SourceRecheckPreview = z.infer<typeof sourceRecheckPreviewSchema>;

export const sourcePinMatchSchema = z.object({
	match: z.enum(["exact", "none"]),
	pinId: z.string().min(1),
	rangeText: z.string(),
	targetId: z.string().min(1),
	targetKind: z.string().min(1),
});

export const sourceCompareViewSchema = z.object({
	approvedContent: z.string(),
	candidateContent: z.string().nullable(),
	changed: z.boolean(),
	copy: z.object({
		noMatchInCandidateVersion: z.literal(
			SOURCES_COPY.noMatchInCandidateVersion
		),
	}),
	pinMatches: z.array(sourcePinMatchSchema),
});

export type SourceCompareView = z.infer<typeof sourceCompareViewSchema>;

export const sourceEvidenceUseViewSchema = z.object({
	accessedAt: z.string(),
	id: z.string().min(1),
	newerSourceVersionExists: z.boolean(),
	rangeText: z.string(),
	reviewed: z.boolean(),
	sourceVersionNumber: z.number().int().positive(),
	targetId: z.string().min(1),
	targetKind: z.string().min(1),
});

export type SourceEvidenceUseView = z.infer<typeof sourceEvidenceUseViewSchema>;

export const sourceVersionInUseSignalViewSchema = z.object({
	section: z.literal(SOURCE_VERSION_IN_USE_SIGNAL_SECTION),
	signalId: z.literal(SOURCE_VERSION_IN_USE_SIGNAL_ID),
	sourceId: z.string().min(1),
	uses: z.array(sourceEvidenceUseViewSchema),
});

export type SourceVersionInUseSignalView = z.infer<
	typeof sourceVersionInUseSignalViewSchema
>;

export const sourceFreshnessViewSchema = z.object({
	checks: z.array(sourceCheckViewSchema),
	signal: sourceVersionInUseSignalViewSchema.nullable(),
	source: sourceViewSchema,
	uses: z.array(sourceEvidenceUseViewSchema),
});

export type SourceFreshnessView = z.infer<typeof sourceFreshnessViewSchema>;

export const recheckSourceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		sourceId: z.string().min(1),
	}),
});

export type RecheckSourceCommand = z.infer<typeof recheckSourceCommandSchema>;

export const keepCurrentVersionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		checkId: z.string().min(1),
	}),
});

export const saveCheckVersionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		checkId: z.string().min(1),
	}),
});

export const sourceEvidenceUseCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		pinId: z.string().min(1),
		rationale: z.string().optional(),
	}),
});

export const bindSourceEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: z.object({
		rangeText: z.string().min(1),
		sourceId: z.string().min(1),
		sourceVersionId: z.string().min(1),
		targetId: z.string().min(1),
		targetKind: z.enum(["Work", "Decision", "Risk"]),
		viewerWorkspaceId: z.string().min(1),
	}),
});

export const sourceCheckOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		check: sourceCheckViewSchema,
		source: sourceViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		check: sourceCheckViewSchema,
		source: sourceViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"source-not-found",
			"check-not-found",
			"candidate-missing",
		]),
		status: z.literal("rejected"),
	}),
]);

export type SourceCheckOutcome = z.infer<typeof sourceCheckOutcomeSchema>;

export const sourceEvidenceUseOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		freshness: sourceFreshnessViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		freshness: sourceFreshnessViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		copy: z
			.object({
				noMatchInCandidateVersion: z.literal(
					SOURCES_COPY.noMatchInCandidateVersion
				),
			})
			.optional(),
		reason: z.enum([
			"invalid-command",
			"pin-not-found",
			"no-match-in-candidate-version",
			"source-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type SourceEvidenceUseOutcome = z.infer<
	typeof sourceEvidenceUseOutcomeSchema
>;
