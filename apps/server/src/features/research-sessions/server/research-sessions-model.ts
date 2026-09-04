import { z } from "zod";

export const RESEARCH_SESSIONS_COPY = {
	allowed: "Allowed",
	attachFile: "Attach File Attachment",
	cancelled: "Cancelled",
	channel: "Channel",
	completed: "Completed",
	consent: "Consent",
	consentIsNotLegalJudgment: "Consent is not a legal compliance judgment.",
	consentNote: "Consent note",
	contact: "Contact",
	createResearchSession: "Create Research Session",
	duration: "Duration",
	facilitator: "Facilitator",
	identifyingPersonalNote: "Identifying personal note",
	noResearchSessions: "No Research Sessions yet.",
	notAllowed: "Not allowed",
	notApplicable: "Not applicable",
	notAsked: "Not asked",
	optionalContact: "Contact (optional)",
	participantQuote: "Participant quote",
	planned: "Planned",
	purpose: "Purpose",
	questionGuide: "Question guide",
	recordedBy: "Recorded by",
	researchSession: "Research Session",
	scheduledAt: "Time",
	scopeNote: "Scope note",
	speakerLabel: "Speaker label",
	status: "Status",
	title: "Title",
	youRemainResponsible: "You remain responsible for your obligations.",
} as const;

export const RESEARCH_SESSION_STATUS = {
	cancelled: RESEARCH_SESSIONS_COPY.cancelled,
	completed: RESEARCH_SESSIONS_COPY.completed,
	planned: RESEARCH_SESSIONS_COPY.planned,
} as const;

export const RESEARCH_SESSION_STATUSES = [
	RESEARCH_SESSION_STATUS.planned,
	RESEARCH_SESSION_STATUS.completed,
	RESEARCH_SESSION_STATUS.cancelled,
] as const;

export type ResearchSessionStatus = (typeof RESEARCH_SESSION_STATUSES)[number];

export const CONSENT = {
	allowed: RESEARCH_SESSIONS_COPY.allowed,
	notAllowed: RESEARCH_SESSIONS_COPY.notAllowed,
	notApplicable: RESEARCH_SESSIONS_COPY.notApplicable,
	notAsked: RESEARCH_SESSIONS_COPY.notAsked,
} as const;

export const CONSENT_VALUES = [
	CONSENT.notAsked,
	CONSENT.allowed,
	CONSENT.notAllowed,
	CONSENT.notApplicable,
] as const;

export type ConsentValue = (typeof CONSENT_VALUES)[number];

export const NOTE_KIND = {
	identifyingPersonalNote: RESEARCH_SESSIONS_COPY.identifyingPersonalNote,
	participantQuote: RESEARCH_SESSIONS_COPY.participantQuote,
} as const;

export const NOTE_KINDS = [
	NOTE_KIND.participantQuote,
	NOTE_KIND.identifyingPersonalNote,
] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

export const RESEARCH_SESSION_EVENT_KIND = {
	attachFile: "attach-file",
	create: "create",
	setConsent: "set-consent",
	setParticipant: "set-participant",
	setStatus: "set-status",
	writeNote: "write-note",
} as const;

export const CLOSED_WORLD_ITEM_KIND = {
	consent: RESEARCH_SESSIONS_COPY.consent,
	contact: RESEARCH_SESSIONS_COPY.contact,
	fileAttachment: "File Attachment",
	identifyingPersonalNote: NOTE_KIND.identifyingPersonalNote,
	participantQuote: NOTE_KIND.participantQuote,
	researchSession: RESEARCH_SESSIONS_COPY.researchSession,
} as const;

export function consentGatesOpen(consent: ConsentValue): boolean {
	return consent === CONSENT.allowed || consent === CONSENT.notApplicable;
}

export const KISISEL_VERI_FIXTURE = {
	consentStates: CONSENT_VALUES,
	name: "Kişisel veri",
} as const;

export const researchSessionNoteViewSchema = z.object({
	body: z.string(),
	capturedUnderConsent: z.enum(CONSENT_VALUES),
	id: z.string().min(1),
	kind: z.enum(NOTE_KINDS),
	speakerLabel: z.string().nullable(),
});

export const researchSessionFileViewSchema = z.object({
	capturedUnderConsent: z.enum(CONSENT_VALUES),
	fileAttachmentId: z.string().min(1),
	id: z.string().min(1),
});

export const researchSessionViewSchema = z.object({
	channel: z.string(),
	consent: z.enum(CONSENT_VALUES),
	consentGatesOpen: z.boolean(),
	consentIsNotLegalJudgment: z.literal(
		RESEARCH_SESSIONS_COPY.consentIsNotLegalJudgment
	),
	consentNote: z.string(),
	consentRecordedAt: z.string(),
	consentRecordedByUserId: z.string().min(1),
	contactId: z.string().min(1).nullable(),
	durationMinutes: z.number().int().positive().nullable(),
	facilitator: z.string(),
	files: z.array(researchSessionFileViewSchema),
	id: z.string().min(1),
	notes: z.array(researchSessionNoteViewSchema),
	projectId: z.string().min(1),
	purpose: z.string(),
	questionGuide: z.string(),
	recordKind: z.literal(RESEARCH_SESSIONS_COPY.researchSession),
	revision: z.number().int().positive(),
	scheduledAt: z.string().nullable(),
	scopeNote: z.string(),
	status: z.enum(RESEARCH_SESSION_STATUSES),
	title: z.string(),
	youRemainResponsible: z.literal(RESEARCH_SESSIONS_COPY.youRemainResponsible),
});

export type ResearchSessionView = z.infer<typeof researchSessionViewSchema>;

export const createResearchSessionPayloadSchema = z.object({
	channel: z.string(),
	consent: z.enum(CONSENT_VALUES).optional(),
	consentNote: z.string().optional(),
	contactId: z.string().min(1).nullable().optional(),
	durationMinutes: z.number().int().positive().nullable().optional(),
	facilitator: z.string(),
	projectId: z.string().min(1),
	purpose: z.string(),
	questionGuide: z.string(),
	scheduledAt: z.string().nullable().optional(),
	scopeNote: z.string(),
	status: z.enum(RESEARCH_SESSION_STATUSES).optional(),
	title: z.string(),
});

export type CreateResearchSessionPayload = z.infer<
	typeof createResearchSessionPayloadSchema
>;

export const createResearchSessionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createResearchSessionPayloadSchema,
});

export type CreateResearchSessionCommand = z.infer<
	typeof createResearchSessionCommandSchema
>;

export const setConsentPayloadSchema = z.object({
	consent: z.enum(CONSENT_VALUES),
	consentNote: z.string().optional(),
	sessionId: z.string().min(1),
});

export const setConsentCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setConsentPayloadSchema,
});

export type SetConsentCommand = z.infer<typeof setConsentCommandSchema>;

export const setStatusPayloadSchema = z.object({
	sessionId: z.string().min(1),
	status: z.enum(RESEARCH_SESSION_STATUSES),
});

export const setStatusCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setStatusPayloadSchema,
});

export type SetStatusCommand = z.infer<typeof setStatusCommandSchema>;

export const setParticipantPayloadSchema = z.object({
	contactId: z.string().min(1).nullable(),
	sessionId: z.string().min(1),
});

export const setParticipantCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setParticipantPayloadSchema,
});

export type SetParticipantCommand = z.infer<typeof setParticipantCommandSchema>;

export const writeNotePayloadSchema = z.object({
	body: z.string().min(1),
	kind: z.enum(NOTE_KINDS).optional(),
	sessionId: z.string().min(1),
	speakerLabel: z.string().min(1).nullable().optional(),
});

export const writeNoteCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: writeNotePayloadSchema,
});

export type WriteNoteCommand = z.infer<typeof writeNoteCommandSchema>;

export const attachFilePayloadSchema = z.object({
	fileAttachmentId: z.string().min(1),
	sessionId: z.string().min(1),
});

export const attachFileCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: attachFilePayloadSchema,
});

export type AttachFileCommand = z.infer<typeof attachFileCommandSchema>;

export const convertPayloadSchema = z.object({
	previewAcknowledged: z.boolean().optional(),
	sessionId: z.string().min(1),
});

export const convertCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: convertPayloadSchema,
});

export type ConvertCommand = z.infer<typeof convertCommandSchema>;

export const includeInSharePayloadSchema = z.object({
	itemId: z.string().min(1),
	sessionId: z.string().min(1),
});

export const includeInShareCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: includeInSharePayloadSchema,
});

export type IncludeInShareCommand = z.infer<typeof includeInShareCommandSchema>;

const rejectReasons = [
	"invalid-command",
	"session-not-found",
	"consent-gates-closed",
	"preview-required",
] as const;

export const researchSessionWriteOutcomeSchema = z.union([
	z.object({
		session: researchSessionViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		session: researchSessionViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum(rejectReasons),
		status: z.literal("rejected"),
	}),
]);

export type ResearchSessionWriteOutcome = z.infer<
	typeof researchSessionWriteOutcomeSchema
>;

export const convertOutcomeSchema = z.union([
	z.object({
		reason: z.enum(["consent-gates-closed", "preview-required"]),
		status: z.literal("rejected"),
	}),
	z.object({
		reason: z.literal("invalid-command"),
		status: z.literal("rejected"),
	}),
]);

export type ConvertOutcome = z.infer<typeof convertOutcomeSchema>;

export const includeInShareOutcomeSchema = z.union([
	z.object({
		included: z.literal(true),
		status: z.literal("committed"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"session-not-found",
			"consent-gates-closed",
		]),
		status: z.literal("rejected"),
	}),
]);

export type IncludeInShareOutcome = z.infer<typeof includeInShareOutcomeSchema>;

export const closedWorldItemSchema = z.discriminatedUnion("kind", [
	z.object({
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.researchSession),
		title: z.string(),
	}),
	z.object({
		consent: z.enum(CONSENT_VALUES),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.consent),
	}),
	z.object({
		contactId: z.string().min(1),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.contact),
	}),
	z.object({
		body: z.string(),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.participantQuote),
		speakerLabel: z.string().nullable(),
	}),
	z.object({
		body: z.string(),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.identifyingPersonalNote),
	}),
	z.object({
		fileAttachmentId: z.string().min(1),
		id: z.string().min(1),
		kind: z.literal(CLOSED_WORLD_ITEM_KIND.fileAttachment),
	}),
]);

export type ClosedWorldItem = z.infer<typeof closedWorldItemSchema>;

export const publishedSnapshotSchema = z.object({
	includedItemIds: z.array(z.string().min(1)),
	includedRevision: z.number().int().positive(),
	sessionId: z.string().min(1),
});

export type PublishedSnapshot = z.infer<typeof publishedSnapshotSchema>;

export const resolvePublishedSnapshotOutcomeSchema = z.object({
	items: z.array(closedWorldItemSchema),
	redirected: z.literal(false),
	silentlyUpdated: z.literal(false),
});

export type ResolvePublishedSnapshotOutcome = z.infer<
	typeof resolvePublishedSnapshotOutcomeSchema
>;
