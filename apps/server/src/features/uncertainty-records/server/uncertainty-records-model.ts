import { z } from "zod";

export const UNCERTAINTY_COPY = {
	answer: "Answer",
	answered: "Answered",
	assumption: "Assumption",
	confirmed: "Confirmed",
	context: "Context",
	createOpenQuestion: "Create Open Question",
	evidence: "Evidence",
	evidenceMissing: "Evidence missing",
	noLongerApplicable: "No longer applicable",
	noOpenQuestions: "No Open Questions yet.",
	open: "Open",
	openQuestion: "Open Question",
	question: "Question",
	rationale: "Rationale",
	recordOutcome: "Record outcome",
	refuted: "Refuted",
	title: "Title",
} as const;

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

export const ASSUMPTION_LIVES = [
	UNCERTAINTY_COPY.open,
	UNCERTAINTY_COPY.confirmed,
	UNCERTAINTY_COPY.refuted,
	UNCERTAINTY_COPY.noLongerApplicable,
] as const;

export const UNCERTAINTY_RECORD_KINDS = [
	UNCERTAINTY_COPY.assumption,
	UNCERTAINTY_COPY.openQuestion,
] as const;

export const OPEN_QUESTION_EVENT_KIND = {
	create: "create",
	setLife: "set-life",
} as const;

export const RELATIONS_KIND_QUESTION = "Question" as const;

export const evidenceRowSchema = z.object({
	id: z.string().min(1),
	sourceId: z.string().min(1),
	sourceKind: z.string().min(1),
	type: z.literal(UNCERTAINTY_COPY.evidence),
});

export const openQuestionViewSchema = z.object({
	answer: z.string(),
	autoConverted: z.object({
		decision: z.literal(false),
		risk: z.literal(false),
		work: z.literal(false),
	}),
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

export const exactEvidenceSchema = z.object({
	sourceId: z.string().min(1),
	sourceKind: z.string().min(1),
});

export const createOpenQuestionPayloadSchema = z.object({
	context: z.string(),
	projectId: z.string().min(1),
	question: z.string(),
	title: z.string(),
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
	evidence: exactEvidenceSchema.optional(),
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
