import { z } from "zod";

export const FEEDBACK_COPY = {
	archived: "Archived",
	attachments: "Attachments",
	audienceFit: "Audience fit",
	bindAsEvidenceToExistingRecord: "Bind as evidence to existing record",
	channel: "Channel",
	company: "Company",
	contact: "Contact",
	contradicting: "Contradicting",
	convertToWork: "Convert to Work",
	createFeedback: "Create Feedback",
	createFromSource: "Create from Source",
	currentWorkaround: "Current workaround",
	description: "Description",
	evidenceQuality: "Evidence quality",
	evidenceRole: "Evidence Role",
	feedback: "Feedback",
	followedUp: "Followed up",
	followUp: "Follow up",
	founderInterpretation: "Founder interpretation",
	impactSeverity: "Impact severity",
	inconclusive: "Inconclusive",
	independence: "Independence",
	link: "Link",
	new: "New",
	noFeedback: "No Feedback yet.",
	occurredAt: "Occurred at",
	origin: "Origin",
	originalMessage: "Original message",
	outcomeVerified: "Outcome verified",
	project: "Project",
	providesContext: "Provides context",
	reportedProblem: "Reported problem",
	reviewed: "Reviewed",
	source: "Source",
	status: "Status",
	suggestedSolution: "Suggested solution",
	supporting: "Supporting",
	title: "Title",
	unknown: "Unknown",
	unspecified: "Unspecified",
	usageFrequency: "Usage frequency",
	work: "Work",
} as const;

export const FEEDBACK_STATUS = {
	archived: FEEDBACK_COPY.archived,
	new: FEEDBACK_COPY.new,
	reviewed: FEEDBACK_COPY.reviewed,
} as const;

export const FEEDBACK_STATUSES = [
	FEEDBACK_STATUS.new,
	FEEDBACK_STATUS.reviewed,
	FEEDBACK_STATUS.archived,
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_RECORD_KIND = FEEDBACK_COPY.feedback;

export const FEEDBACK_EVENT_KIND = {
	create: "create",
	setStatus: "set-status",
} as const;

export const FEEDBACK_COUNTERPARTS = {
	ai: false,
	automaticPriority: false,
	candidateSnapshot: false,
	combinedScore: false,
	comments: false,
	contactMerge: false,
	copiesQualityAcrossWork: false,
	emailSync: false,
	evidenceFlow: false,
	extractsFromMessage: false,
	featureRequest: false,
	multiRecordSpawn: false,
	personalDataErase: false,
	publicForm: false,
	requesterThread: false,
	socialPost: false,
	sourceSubtype: false,
	sourceVersionLife: false,
	urlRecheck: false,
	voteScoring: false,
	votes: false,
	workRecord: false,
	writesWorkPlanning: false,
	writesWorkPriority: false,
	writesWorkStatus: false,
} as const;

export const FEEDBACK_EVIDENCE_ROLES = [
	FEEDBACK_COPY.supporting,
	FEEDBACK_COPY.contradicting,
	FEEDBACK_COPY.providesContext,
	FEEDBACK_COPY.inconclusive,
	FEEDBACK_COPY.unspecified,
] as const;

export type FeedbackEvidenceRole = (typeof FEEDBACK_EVIDENCE_ROLES)[number];

export const FEEDBACK_FOLLOW_UP_STATUSES = [
	FEEDBACK_COPY.followUp,
	FEEDBACK_COPY.followedUp,
	FEEDBACK_COPY.outcomeVerified,
] as const;

export type FeedbackFollowUpStatus =
	(typeof FEEDBACK_FOLLOW_UP_STATUSES)[number];

export const FEEDBACK_FOREIGN_RECORD_KINDS = [
	"Source",
	"Work",
	"Feature",
	"Feature request",
] as const;

export function feedbackCatalog() {
	return {
		copy: FEEDBACK_COPY,
		counterparts: FEEDBACK_COUNTERPARTS,
		evidenceRoles: FEEDBACK_EVIDENCE_ROLES,
		followUpStatuses: FEEDBACK_FOLLOW_UP_STATUSES,
		foreignRecordKinds: FEEDBACK_FOREIGN_RECORD_KINDS,
		kind: FEEDBACK_RECORD_KIND,
		statuses: FEEDBACK_STATUSES,
	};
}

export const feedbackAttachmentViewSchema = z.object({
	fileAttachmentId: z.string().min(1),
	id: z.string().min(1),
});

export const feedbackViewSchema = z.object({
	attachments: z.array(feedbackAttachmentViewSchema),
	channel: z.string().min(1),
	companyId: z.string().min(1).nullable(),
	contactId: z.string().min(1).nullable(),
	id: z.string().min(1),
	occurredAt: z.string().min(1),
	originalMessage: z.string().min(1),
	projectId: z.string().min(1),
	recordKind: z.literal(FEEDBACK_RECORD_KIND),
	revision: z.number().int().positive(),
	status: z.enum(FEEDBACK_STATUSES),
	url: z.string().min(1).nullable(),
});

export type FeedbackView = z.infer<typeof feedbackViewSchema>;

const optionalLink = z
	.string()
	.trim()
	.optional()
	.transform((value) => (value && value.length > 0 ? value : null));

export const createFeedbackPayloadSchema = z
	.object({
		attachmentIds: z.array(z.string().min(1)).optional(),
		channel: z.string().trim().min(1),
		companyId: z.string().min(1).optional(),
		contactId: z.string().min(1).optional(),
		occurredAt: z.string().optional(),
		originalMessage: z.string().trim().min(1),
		projectId: z.string().min(1),
		url: optionalLink,
	})
	.strict();

export type CreateFeedbackPayload = z.infer<typeof createFeedbackPayloadSchema>;

export const createFeedbackCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createFeedbackPayloadSchema,
	viewerWorkspaceId: z.string().min(1).optional(),
});

export type CreateFeedbackCommand = z.infer<typeof createFeedbackCommandSchema>;

export const createFeedbackFromSourcePayloadSchema = z
	.object({
		channel: z.string().trim().min(1),
		sourceId: z.string().min(1),
	})
	.strict();

export const createFeedbackFromSourceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createFeedbackFromSourcePayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type CreateFeedbackFromSourceCommand = z.infer<
	typeof createFeedbackFromSourceCommandSchema
>;

export const setFeedbackStatusPayloadSchema = z
	.object({
		feedbackId: z.string().min(1),
		status: z.enum(FEEDBACK_STATUSES),
	})
	.strict();

export const setFeedbackStatusCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setFeedbackStatusPayloadSchema,
});

export type SetFeedbackStatusCommand = z.infer<
	typeof setFeedbackStatusCommandSchema
>;

export const feedbackWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		feedback: feedbackViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		feedback: feedbackViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"feedback-not-found",
			"source-not-found",
			"origin-not-created",
			"contact-not-found",
			"company-not-found",
			"identity-not-linked",
			"work-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type FeedbackWriteOutcome = z.infer<typeof feedbackWriteOutcomeSchema>;

export const previewConvertFeedbackToWorkInputSchema = z.object({
	feedbackId: z.string().min(1),
	projectId: z.string().min(1).optional(),
	title: z.string().optional(),
});

export type PreviewConvertFeedbackToWorkInput = z.infer<
	typeof previewConvertFeedbackToWorkInputSchema
>;

export const convertFeedbackPreviewSchema = z.object({
	body: z.string(),
	fingerprint: z.string().min(1),
	label: z.literal(FEEDBACK_COPY.convertToWork),
	origin: z.literal("Origin"),
	projectId: z.string().min(1),
	recordKind: z.literal("Work"),
	recordsToCreate: z.literal(1),
	title: z.string(),
});

export type ConvertFeedbackPreview = z.infer<
	typeof convertFeedbackPreviewSchema
>;

export const previewConvertFeedbackOutcomeSchema = z.union([
	z.object({
		preview: convertFeedbackPreviewSchema,
		status: z.literal("ok"),
	}),
	z.object({
		reason: z.enum(["invalid-command", "feedback-not-found"]),
		status: z.literal("rejected"),
	}),
]);

export type PreviewConvertFeedbackOutcome = z.infer<
	typeof previewConvertFeedbackOutcomeSchema
>;

export const convertFeedbackToWorkPayloadSchema = z
	.object({
		feedbackId: z.string().min(1),
		previewAcknowledged: z.literal(true).optional(),
		previewFingerprint: z.string().min(1).optional(),
		projectId: z.string().min(1).optional(),
		title: z.string().optional(),
	})
	.strict();

export const convertFeedbackToWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: convertFeedbackToWorkPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type ConvertFeedbackToWorkCommand = z.infer<
	typeof convertFeedbackToWorkCommandSchema
>;

export const convertedWorkRecordSchema = z.object({
	id: z.string().min(1),
	kind: z.literal("Work"),
	title: z.string().min(1),
});

export const convertFeedbackOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		feedback: feedbackViewSchema,
		records: z.array(convertedWorkRecordSchema).length(1),
		status: z.literal("committed"),
	}),
	z.object({
		feedback: feedbackViewSchema,
		records: z.array(convertedWorkRecordSchema).length(1),
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"feedback-not-found",
			"preview-required",
			"preview-mismatch",
			"missing-title",
			"origin-not-created",
			"work-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type ConvertFeedbackOutcome = z.infer<
	typeof convertFeedbackOutcomeSchema
>;

export const bindFeedbackOriginPayloadSchema = z
	.object({
		feedbackId: z.string().min(1),
		workId: z.string().min(1),
	})
	.strict();

export const bindFeedbackOriginCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: bindFeedbackOriginPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type BindFeedbackOriginCommand = z.infer<
	typeof bindFeedbackOriginCommandSchema
>;

export const bindFeedbackOriginOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		feedback: feedbackViewSchema,
		status: z.literal("committed"),
		workId: z.string().min(1),
	}),
	z.object({
		feedback: feedbackViewSchema,
		status: z.literal("replayed"),
		workId: z.string().min(1),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"feedback-not-found",
			"work-not-found",
			"origin-not-created",
		]),
		status: z.literal("rejected"),
	}),
]);

export type BindFeedbackOriginOutcome = z.infer<
	typeof bindFeedbackOriginOutcomeSchema
>;

const optionalQualityText = z
	.string()
	.transform((value) => value.trim())
	.optional();

export const feedbackEvidenceViewSchema = z.object({
	audienceFit: z.string(),
	currentWorkaround: z.string(),
	evidenceRole: z.enum(FEEDBACK_EVIDENCE_ROLES),
	feedbackId: z.string().min(1),
	followUp: z.enum(FEEDBACK_FOLLOW_UP_STATUSES).nullable(),
	id: z.string().min(1),
	impactSeverity: z.string(),
	independence: z.string(),
	interpretationActorId: z.string().min(1).nullable(),
	interpretationSetAt: z.string().min(1).nullable(),
	originalMessage: z.string().min(1),
	relationId: z.string().min(1),
	reportedProblem: z.string(),
	suggestedSolution: z.string(),
	usageFrequency: z.string(),
	workId: z.string().min(1),
});

export type FeedbackEvidenceView = z.infer<typeof feedbackEvidenceViewSchema>;

export const bindFeedbackEvidencePayloadSchema = z
	.object({
		feedbackId: z.string().min(1),
		workId: z.string().min(1),
	})
	.strict();

export const bindFeedbackEvidenceCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: bindFeedbackEvidencePayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type BindFeedbackEvidenceCommand = z.infer<
	typeof bindFeedbackEvidenceCommandSchema
>;

export const bindFeedbackEvidenceOutcomeSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			evidence: feedbackEvidenceViewSchema,
			feedback: feedbackViewSchema,
			status: z.literal("committed"),
		}),
		z.object({
			evidence: feedbackEvidenceViewSchema,
			feedback: feedbackViewSchema,
			status: z.literal("replayed"),
		}),
		z.object({
			conflict: z.literal("Conflict"),
			status: z.literal("conflict"),
		}),
		z.object({
			reason: z.enum([
				"invalid-command",
				"feedback-not-found",
				"work-not-found",
				"evidence-not-created",
			]),
			status: z.literal("rejected"),
		}),
	]
);

export type BindFeedbackEvidenceOutcome = z.infer<
	typeof bindFeedbackEvidenceOutcomeSchema
>;

export const listFeedbackEvidenceInputSchema = z
	.object({
		feedbackId: z.string().min(1).optional(),
		workId: z.string().min(1).optional(),
	})
	.refine((value) => Boolean(value.feedbackId || value.workId));

export type ListFeedbackEvidenceInput = z.infer<
	typeof listFeedbackEvidenceInputSchema
>;

export const setFeedbackEvidenceQualityPayloadSchema = z
	.object({
		audienceFit: optionalQualityText,
		currentWorkaround: optionalQualityText,
		feedbackId: z.string().min(1),
		impactSeverity: optionalQualityText,
		independence: optionalQualityText,
		reportedProblem: optionalQualityText,
		suggestedSolution: optionalQualityText,
		usageFrequency: optionalQualityText,
		workId: z.string().min(1),
	})
	.strict();

export const setFeedbackEvidenceQualityCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setFeedbackEvidenceQualityPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type SetFeedbackEvidenceQualityCommand = z.infer<
	typeof setFeedbackEvidenceQualityCommandSchema
>;

export const setFeedbackEvidenceRolePayloadSchema = z
	.object({
		evidenceRole: z.enum(FEEDBACK_EVIDENCE_ROLES),
		feedbackId: z.string().min(1),
		workId: z.string().min(1),
	})
	.strict();

export const setFeedbackEvidenceRoleCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setFeedbackEvidenceRolePayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type SetFeedbackEvidenceRoleCommand = z.infer<
	typeof setFeedbackEvidenceRoleCommandSchema
>;

export const setFeedbackEvidenceFollowUpPayloadSchema = z
	.object({
		feedbackId: z.string().min(1),
		followUp: z.enum(FEEDBACK_FOLLOW_UP_STATUSES).nullable(),
		workId: z.string().min(1),
	})
	.strict();

export const setFeedbackEvidenceFollowUpCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setFeedbackEvidenceFollowUpPayloadSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type SetFeedbackEvidenceFollowUpCommand = z.infer<
	typeof setFeedbackEvidenceFollowUpCommandSchema
>;

export const feedbackEvidenceWriteOutcomeSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			evidence: feedbackEvidenceViewSchema,
			feedback: feedbackViewSchema,
			status: z.literal("committed"),
		}),
		z.object({
			evidence: feedbackEvidenceViewSchema,
			feedback: feedbackViewSchema,
			status: z.literal("replayed"),
		}),
		z.object({
			conflict: z.literal("Conflict"),
			status: z.literal("conflict"),
		}),
		z.object({
			reason: z.enum([
				"invalid-command",
				"feedback-not-found",
				"work-not-found",
				"evidence-not-found",
			]),
			status: z.literal("rejected"),
		}),
	]
);

export type FeedbackEvidenceWriteOutcome = z.infer<
	typeof feedbackEvidenceWriteOutcomeSchema
>;
