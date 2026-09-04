import { z } from "zod";

export const FEEDBACK_COPY = {
	archived: "Archived",
	attachments: "Attachments",
	channel: "Channel",
	company: "Company",
	contact: "Contact",
	convertToWork: "Convert to Work",
	createFeedback: "Create Feedback",
	createFromSource: "Create from Source",
	decision: "Decision",
	description: "Description",
	feed: "Feed",
	feedback: "Feedback",
	link: "Link",
	new: "New",
	noFeed: "No Feed records yet.",
	noFeedback: "No Feedback yet.",
	occurredAt: "Occurred at",
	openSourceRecord: "Open Source Record",
	origin: "Origin",
	originalMessage: "Original message",
	project: "Project",
	reviewed: "Reviewed",
	source: "Source",
	status: "Status",
	title: "Title",
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
	comments: false,
	contactMerge: false,
	featureRequest: false,
	feedRecordType: false,
	inboxProduct: false,
	multiRecordSpawn: false,
	personalDataErase: false,
	publicForm: false,
	requesterThread: false,
	socialPost: false,
	sourceRecheckApi: false,
	sourceSubtype: false,
	sourceVersionLife: false,
	supportTool: false,
	unifiedNotificationCenter: false,
	universalSearch: false,
	urlRecheck: false,
	voteScoring: false,
	votes: false,
	workRecord: false,
	writesSourcePriority: false,
	writesSourceStatus: false,
	writesWorkPlanning: false,
	writesWorkPriority: false,
	writesWorkStatus: false,
} as const;

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

export const FEED_SORT_FIELDS = ["title"] as const;

export type FeedSortField = (typeof FEED_SORT_FIELDS)[number];

export const feedRowSchema = z.object({
	attachments: z.array(feedbackAttachmentViewSchema),
	body: z.string(),
	id: z.string().min(1),
	identityOrChannel: z.string().min(1),
	occurredAt: z.string().min(1),
	openSourceRecord: z.literal(FEEDBACK_COPY.openSourceRecord),
	projectId: z.string().min(1),
	recordKind: z.enum([FEEDBACK_RECORD_KIND, "Source"]),
	relatedDecisionIds: z.array(z.string().min(1)),
	relatedWorkIds: z.array(z.string().min(1)),
});

export type FeedRow = z.infer<typeof feedRowSchema>;

export const feedViewSchema = z.object({
	notificationSignals: z.tuple([]),
	rows: z.array(feedRowSchema),
	socialActions: z.tuple([]),
	writes: z.object({
		priority: z.literal(false),
		status: z.literal(false),
	}),
});

export type FeedView = z.infer<typeof feedViewSchema>;

export const listFeedQuerySchema = z.object({
	filterText: z.string().optional(),
	projectId: z.string().min(1),
	sortDirection: z.enum(["asc", "desc"]).optional(),
	sortField: z.enum(FEED_SORT_FIELDS).optional(),
});

export type ListFeedQuery = z.infer<typeof listFeedQuerySchema>;
