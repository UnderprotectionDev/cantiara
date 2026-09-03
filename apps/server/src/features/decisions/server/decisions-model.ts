import { z } from "zod";

export const DECISIONS_COPY = {
	createDecision: "Create Decision",
	decision: "Decision",
	decisionText: "Decision text",
	noDecisions: "No Decisions yet.",
	rationale: "Rationale",
	superseded: "Superseded",
	title: "Title",
	valid: "Valid",
	withdraw: "Withdraw",
	withdrawn: "Withdrawn",
} as const;

export const DECISION_LIFE = {
	superseded: DECISIONS_COPY.superseded,
	valid: DECISIONS_COPY.valid,
	withdrawn: DECISIONS_COPY.withdrawn,
} as const;

export const DECISION_LIVES = [
	DECISION_LIFE.valid,
	DECISION_LIFE.superseded,
	DECISION_LIFE.withdrawn,
] as const;

export type DecisionLife = (typeof DECISION_LIVES)[number];

export const DECISION_EVENT_KIND = {
	create: "create",
	withdraw: "withdraw",
} as const;

export function presentDecisionLife(
	stored: string | null | undefined
): DecisionLife {
	if (stored === DECISION_LIFE.withdrawn) {
		return DECISION_LIFE.withdrawn;
	}
	if (stored === DECISION_LIFE.superseded) {
		return DECISION_LIFE.superseded;
	}
	return DECISION_LIFE.valid;
}

export const decisionViewSchema = z.object({
	decision: z.string(),
	id: z.string().min(1),
	life: z.enum(DECISION_LIVES),
	projectId: z.string().min(1),
	rationale: z.string(),
	recordKind: z.literal(DECISIONS_COPY.decision),
	revision: z.number().int().positive(),
	title: z.string(),
	withdrawnAt: z.string().nullable(),
	withdrawnRationale: z.string().nullable(),
});

export type DecisionView = z.infer<typeof decisionViewSchema>;

export const createDecisionPayloadSchema = z.object({
	decision: z.string(),
	projectId: z.string().min(1),
	rationale: z.string(),
	title: z.string(),
});

export type CreateDecisionPayload = z.infer<typeof createDecisionPayloadSchema>;

export const createDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createDecisionPayloadSchema,
});

export type CreateDecisionCommand = z.infer<typeof createDecisionCommandSchema>;

export const ingestImportedDecisionPayloadSchema = z.object({
	decision: z.string(),
	life: z.string().nullable().optional(),
	projectId: z.string().min(1),
	rationale: z.string(),
	title: z.string(),
});

export const ingestImportedDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: ingestImportedDecisionPayloadSchema,
});

export type IngestImportedDecisionCommand = z.infer<
	typeof ingestImportedDecisionCommandSchema
>;

export const withdrawDecisionPayloadSchema = z.object({
	decisionId: z.string().min(1),
	rationale: z.string().optional(),
});

export const withdrawDecisionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: withdrawDecisionPayloadSchema,
});

export type WithdrawDecisionCommand = z.infer<
	typeof withdrawDecisionCommandSchema
>;

export const setDecisionLifePayloadSchema = z.object({
	decisionId: z.string().min(1),
	life: z.enum(DECISION_LIVES),
});

export const setDecisionLifeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setDecisionLifePayloadSchema,
});

export type SetDecisionLifeCommand = z.infer<
	typeof setDecisionLifeCommandSchema
>;

export const decisionWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		decision: decisionViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		decision: decisionViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"decision-not-found",
			"superseded-requires-relation",
			"life-not-selectable",
		]),
		status: z.literal("rejected"),
	}),
]);

export type DecisionWriteOutcome = z.infer<typeof decisionWriteOutcomeSchema>;
