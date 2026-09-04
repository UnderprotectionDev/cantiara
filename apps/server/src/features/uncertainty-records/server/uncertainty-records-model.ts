import { z } from "zod";

export const UNCERTAINTY_COPY = {
	assumption: "Assumption",
	confirmed: "Confirmed",
	createAssumption: "Create Assumption",
	evidence: "Evidence",
	missingEvidence: "Missing evidence",
	noAssumptions: "No Assumptions yet.",
	noLongerApplicable: "No longer applicable",
	open: "Open",
	openQuestion: "Open Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	statement: "Statement",
} as const;

export const ASSUMPTION_LIFE = {
	confirmed: UNCERTAINTY_COPY.confirmed,
	noLongerApplicable: UNCERTAINTY_COPY.noLongerApplicable,
	open: UNCERTAINTY_COPY.open,
	refuted: UNCERTAINTY_COPY.refuted,
} as const;

export const ASSUMPTION_LIVES = [
	ASSUMPTION_LIFE.open,
	ASSUMPTION_LIFE.confirmed,
	ASSUMPTION_LIFE.refuted,
	ASSUMPTION_LIFE.noLongerApplicable,
] as const;

export type AssumptionLife = (typeof ASSUMPTION_LIVES)[number];

export const ASSUMPTION_EVENT_KIND = {
	create: "create",
	setLife: "set-life",
} as const;

export const OUTCOME_LIVES = [
	ASSUMPTION_LIFE.confirmed,
	ASSUMPTION_LIFE.refuted,
] as const;

export type AssumptionOutcomeLife = (typeof OUTCOME_LIVES)[number];

export function isAssumptionOutcomeLife(
	life: AssumptionLife
): life is AssumptionOutcomeLife {
	return life === ASSUMPTION_LIFE.confirmed || life === ASSUMPTION_LIFE.refuted;
}

export function firstProductUncertaintySurfaces() {
	return {
		basedOn: false,
		basisFor: false,
		refutedAssumptionReview: false,
	} as const;
}

export const exactEvidenceSchema = z.object({
	fromId: z.string().min(1),
	fromKind: z.string().min(1),
});

export type ExactEvidence = z.infer<typeof exactEvidenceSchema>;

export const assumptionEvidenceViewSchema = z.object({
	fromId: z.string().min(1),
	fromKind: z.string().min(1),
	id: z.string().min(1),
});

export const assumptionViewSchema = z.object({
	evidence: z.array(assumptionEvidenceViewSchema),
	evidenceMissing: z.boolean(),
	id: z.string().min(1),
	life: z.enum(ASSUMPTION_LIVES),
	outcomeRationale: z.string().nullable(),
	projectId: z.string().min(1),
	rationale: z.string(),
	recordKind: z.literal(UNCERTAINTY_COPY.assumption),
	revision: z.number().int().positive(),
	statement: z.string(),
});

export type AssumptionView = z.infer<typeof assumptionViewSchema>;

export const createAssumptionPayloadSchema = z.object({
	projectId: z.string().min(1),
	rationale: z.string(),
	statement: z.string(),
});

export const createAssumptionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createAssumptionPayloadSchema,
});

export type CreateAssumptionCommand = z.infer<
	typeof createAssumptionCommandSchema
>;

export const setAssumptionLifePayloadSchema = z.object({
	assumptionId: z.string().min(1),
	evidence: exactEvidenceSchema.optional(),
	life: z.enum(ASSUMPTION_LIVES),
	rationale: z.string().optional(),
});

export const setAssumptionLifeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setAssumptionLifePayloadSchema,
});

export type SetAssumptionLifeCommand = z.infer<
	typeof setAssumptionLifeCommandSchema
>;

export const assumptionWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		assumption: assumptionViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		assumption: assumptionViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum([
			"invalid-command",
			"assumption-not-found",
			"evidence-not-accepted",
			"invalid-evidence",
		]),
		status: z.literal("rejected"),
	}),
]);

export type AssumptionWriteOutcome = z.infer<
	typeof assumptionWriteOutcomeSchema
>;
