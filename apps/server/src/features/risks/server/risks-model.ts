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
		risk: riskViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
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
