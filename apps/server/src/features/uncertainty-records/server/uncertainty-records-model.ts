import { z } from "zod";

export const UNCERTAINTY_COPY = {
	answer: "Answer",
	answered: "Answered",
	assumption: "Assumption",
	confirmed: "Confirmed",
	context: "Context",
	createAssumption: "Create Assumption",
	createOpenQuestion: "Create Open Question",
	evidence: "Evidence",
	evidenceMissing: "Evidence missing",
	missingEvidence: "Missing evidence",
	noAssumptions: "No Assumptions yet.",
	noLongerApplicable: "No longer applicable",
	noOpenQuestions: "No Open Questions yet.",
	open: "Open",
	openQuestion: "Open Question",
	question: "Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	statement: "Statement",
	title: "Title",
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

export const OPEN_QUESTION_LIFE = {
	answered: UNCERTAINTY_COPY.answered,
	noLongerApplicable: UNCERTAINTY_COPY.noLongerApplicable,
	open: UNCERTAINTY_COPY.open,
} as const;

export const OPEN_QUESTION_LIVES = [
	OPEN_QUESTION_LIFE.open,
	OPEN_QUESTION_LIFE.answered,
	OPEN_QUESTION_LIFE.noLongerApplicable,
] as const;

export type OpenQuestionLife = (typeof OPEN_QUESTION_LIVES)[number];

export const OPEN_QUESTION_EVENT_KIND = {
	create: "create",
	setLife: "set-life",
} as const;

export const UNCERTAINTY_RECORD_KINDS = [
	UNCERTAINTY_COPY.assumption,
	UNCERTAINTY_COPY.openQuestion,
] as const;

export const RELATIONS_KIND_QUESTION = "Question" as const;

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

export const openQuestionExactEvidenceSchema = z.object({
	sourceId: z.string().min(1),
	sourceKind: z.string().min(1),
});

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
			"invalid-evidence",
		]),
		status: z.literal("rejected"),
	}),
]);

export type AssumptionWriteOutcome = z.infer<
	typeof assumptionWriteOutcomeSchema
>;

export const evidenceRowSchema = z.object({
	id: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKind: z.string().min(1),
	type: z.literal(UNCERTAINTY_COPY.evidence),
});

export const openQuestionViewSchema = z.object({
	answer: z.string(),
	context: z.string(),
	evidence: z.array(evidenceRowSchema),
	evidenceMissing: z.boolean(),
	id: z.string().min(1),
	life: z.enum(OPEN_QUESTION_LIVES),
	projectId: z.string().min(1),
	question: z.string(),
	rationale: z.string(),
	recordKind: z.literal(UNCERTAINTY_COPY.openQuestion),
	revision: z.number().int().positive(),
	title: z.string(),
});

export type OpenQuestionView = z.infer<typeof openQuestionViewSchema>;

export const createOpenQuestionPayloadSchema = z.object({
	context: z.string(),
	projectId: z.string().min(1),
	question: z.string().min(1),
	title: z.string().min(1),
});

export const createOpenQuestionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createOpenQuestionPayloadSchema,
});

export type CreateOpenQuestionCommand = z.infer<
	typeof createOpenQuestionCommandSchema
>;

export const setOpenQuestionLifePayloadSchema = z.object({
	answer: z.string().optional(),
	evidence: openQuestionExactEvidenceSchema.optional(),
	life: z.enum(OPEN_QUESTION_LIVES),
	openQuestionId: z.string().min(1),
	rationale: z.string().optional(),
});

export const setOpenQuestionLifeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setOpenQuestionLifePayloadSchema,
});

export type SetOpenQuestionLifeCommand = z.infer<
	typeof setOpenQuestionLifeCommandSchema
>;

export const openQuestionWriteOutcomeSchema = z.discriminatedUnion("status", [
	z.object({
		openQuestion: openQuestionViewSchema,
		status: z.literal("committed"),
	}),
	z.object({
		openQuestion: openQuestionViewSchema,
		status: z.literal("replayed"),
	}),
	z.object({
		conflict: z.literal("Conflict"),
		status: z.literal("conflict"),
	}),
	z.object({
		reason: z.enum(["invalid-command", "open-question-not-found"]),
		status: z.literal("rejected"),
	}),
]);

export type OpenQuestionWriteOutcome = z.infer<
	typeof openQuestionWriteOutcomeSchema
>;
