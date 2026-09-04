import { z } from "zod";

export const FEEDBACK_COPY = {
	archived: "Archived",
	attachments: "Attachments",
	channel: "Channel",
	createFeedback: "Create Feedback",
	createFromSource: "Create from Source",
	feedback: "Feedback",
	link: "Link",
	new: "New",
	noFeedback: "No Feedback yet.",
	occurredAt: "Occurred at",
	originalMessage: "Original message",
	reviewed: "Reviewed",
	source: "Source",
	status: "Status",
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
	candidateSnapshot: false,
	comments: false,
	contactMerge: false,
	featureRequest: false,
	personalDataErase: false,
	publicForm: false,
	requesterThread: false,
	socialPost: false,
	sourceSubtype: false,
	sourceVersionLife: false,
	urlRecheck: false,
	votes: false,
	workRecord: false,
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
		]),
		status: z.literal("rejected"),
	}),
]);

export type FeedbackWriteOutcome = z.infer<typeof feedbackWriteOutcomeSchema>;
