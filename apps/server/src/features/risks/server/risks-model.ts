import { z } from "zod";

export const RISKS_COPY = {
	accepted: "Accepted",
	allRisks: "All Risks",
	createRisk: "Create Risk",
	description: "Description",
	impact: "Impact",
	mitigating: "Mitigating",
	noRisks: "No Risks yet.",
	occurred: "Occurred",
	open: "Open",
	probability: "Probability",
	rationale: "Rationale",
	resolved: "Resolved",
	responseMitigation: "Response/mitigation",
	risk: "Risk",
	setStatus: "Set status",
	title: "Title",
} as const;

export const RISK_STATUS = {
	accepted: RISKS_COPY.accepted,
	mitigating: RISKS_COPY.mitigating,
	occurred: RISKS_COPY.occurred,
	open: RISKS_COPY.open,
	resolved: RISKS_COPY.resolved,
} as const;

export const RISK_STATUSES = [
	RISK_STATUS.open,
	RISK_STATUS.mitigating,
	RISK_STATUS.occurred,
	RISK_STATUS.resolved,
	RISK_STATUS.accepted,
] as const;

export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RISK_EVENT_KIND = {
	create: "create",
	setStatus: "set-status",
} as const;

export const OPEN_RISK_SIGNAL_ID = "open-risk" as const;

export const OPEN_RISK_SIGNAL_SECTION = "Action Required" as const;

export const OPEN_RISK_SOURCE_EVENT = {
	enteredOpen: "entered-open",
	relatedToActiveFocusPeriod: "related-to-active-focus-period",
	relatedToPublishPrepRelease: "related-to-publish-prep-release",
} as const;

export const RISK_RELATED_KIND = {
	focusPeriod: "Focus Period",
	projectRelease: "Project Release",
} as const;

export const RISKS_COUNTERPARTS = {
	acceptIsPublishGate: false,
	autoWorkClose: false,
	followUpWork: false,
	healthVerdict: false,
} as const;

export const FOREIGN_RECORD_KINDS = [
	"Bug",
	"Test Gap",
	"Production Incident",
] as const;

export function presentRiskStatus(
	stored: string | null | undefined
): RiskStatus {
	if (stored === RISK_STATUS.mitigating) {
		return RISK_STATUS.mitigating;
	}
	if (stored === RISK_STATUS.occurred) {
		return RISK_STATUS.occurred;
	}
	if (stored === RISK_STATUS.resolved) {
		return RISK_STATUS.resolved;
	}
	if (stored === RISK_STATUS.accepted) {
		return RISK_STATUS.accepted;
	}
	return RISK_STATUS.open;
}

export const riskViewSchema = z.object({
	acceptanceRationale: z.string().nullable(),
	description: z.string(),
	id: z.string().min(1),
	impact: z.string(),
	probability: z.string(),
	projectId: z.string().min(1),
	recordKind: z.literal(RISKS_COPY.risk),
	response: z.string(),
	revision: z.number().int().positive(),
	status: z.enum(RISK_STATUSES),
	title: z.string(),
});

export type RiskView = z.infer<typeof riskViewSchema>;

export const openRiskSignalViewSchema = z.object({
	followUpWork: z.literal(false),
	healthVerdict: z.literal(false),
	impact: z.string(),
	probability: z.string(),
	riskId: z.string().min(1),
	section: z.literal(OPEN_RISK_SIGNAL_SECTION),
	signalId: z.literal(OPEN_RISK_SIGNAL_ID),
	sourceEventId: z.string().min(1),
	sourceEventKind: z.enum([
		OPEN_RISK_SOURCE_EVENT.enteredOpen,
		OPEN_RISK_SOURCE_EVENT.relatedToPublishPrepRelease,
		OPEN_RISK_SOURCE_EVENT.relatedToActiveFocusPeriod,
	]),
});

export type OpenRiskSignalView = z.infer<typeof openRiskSignalViewSchema>;

export const riskRelatedRecordViewSchema = z.object({
	id: z.string().min(1),
	inPublishPrep: z.boolean().nullable(),
	releaseStatus: z.string().nullable(),
	riskId: z.string().min(1),
	targetId: z.string().min(1),
	targetKind: z.enum([
		RISK_RELATED_KIND.projectRelease,
		RISK_RELATED_KIND.focusPeriod,
	]),
});

export type RiskRelatedRecordView = z.infer<typeof riskRelatedRecordViewSchema>;

export const createRiskPayloadSchema = z
	.object({
		description: z.string(),
		impact: z.string(),
		probability: z.string(),
		projectId: z.string().min(1),
		response: z.string(),
		title: z.string().min(1),
	})
	.strict();

export type CreateRiskPayload = z.infer<typeof createRiskPayloadSchema>;

export const createRiskCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createRiskPayloadSchema,
});

export type CreateRiskCommand = z.infer<typeof createRiskCommandSchema>;

export const setRiskStatusPayloadSchema = z.object({
	rationale: z.string().optional(),
	riskId: z.string().min(1),
	status: z.enum(RISK_STATUSES),
});

export const setRiskStatusCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setRiskStatusPayloadSchema,
});

export type SetRiskStatusCommand = z.infer<typeof setRiskStatusCommandSchema>;

export const riskWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		emissions: z.array(openRiskSignalViewSchema),
		risk: riskViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		emissions: z.array(openRiskSignalViewSchema),
		risk: riskViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum(["invalid-command", "risk-not-found", "rationale-required"]),
		status: z.literal("rejected"),
	}),
]);

export type RiskWriteOutcome = z.infer<typeof riskWriteOutcomeSchema>;

export const relateRiskPayloadSchema = z.discriminatedUnion("kind", [
	z.object({
		inPublishPrep: z.boolean(),
		kind: z.literal(RISK_RELATED_KIND.projectRelease),
		releaseStatus: z.string().optional(),
		riskId: z.string().min(1),
		targetId: z.string().min(1),
	}),
	z.object({
		kind: z.literal(RISK_RELATED_KIND.focusPeriod),
		riskId: z.string().min(1),
		targetId: z.string().min(1),
	}),
]);

export const relateRiskCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: relateRiskPayloadSchema,
});

export type RelateRiskCommand = z.infer<typeof relateRiskCommandSchema>;

export const relateRiskOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		emissions: z.array(openRiskSignalViewSchema),
		related: riskRelatedRecordViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		emissions: z.array(openRiskSignalViewSchema),
		related: riskRelatedRecordViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"risk-not-found",
			"focus-period-not-found",
		]),
		status: z.literal("rejected"),
	}),
]);

export type RelateRiskOutcome = z.infer<typeof relateRiskOutcomeSchema>;
