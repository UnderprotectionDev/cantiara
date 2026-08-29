import { z } from "zod";

export const PRIORITY_RANKS = [
	"Very low",
	"Low",
	"Medium",
	"High",
	"Very high",
] as const;

export type PriorityRank = (typeof PRIORITY_RANKS)[number];

export const PRIORITY_COPY = {
	addPriorityMetric: "Add priority metric",
	archive: "Archive",
	backlog: "Backlog",
	close: "Close",
	createPrioritizationSession: "Create Prioritization Session",
	description: "Description",
	enable: "Enable",
	evidence: "Evidence",
	evidenceStrength: "Evidence strength",
	feedbackRecords: "Feedback records",
	high: "High",
	low: "Low",
	medium: "Medium",
	moveDown: "Move down",
	moveUp: "Move up",
	name: "Name",
	nameRequired: "Name is required.",
	priorityMetrics: "Priority metrics",
	rankExplanation: "Rank explanation",
	reopen: "Reopen",
	risk: "Risk",
	save: "Save",
	sessionClosed:
		"This Prioritization Session is closed. Reopen it or create a new session to reorder.",
	sessionOrder: "Session order",
	targetDate: "Target date",
	unevaluated: "Unevaluated",
	uniqueCompany: "Unique Company",
	uniqueContact: "Unique Contact",
	unknownRank: "This rank is not one of the five fixed levels.",
	veryHigh: "Very high",
	veryLow: "Very low",
} as const;

export const EMPTY_RANK_EXPLANATIONS = {
	High: "",
	Low: "",
	Medium: "",
	"Very high": "",
	"Very low": "",
} as const satisfies Record<PriorityRank, string>;

export const rankExplanationsSchema = z.object({
	High: z.string(),
	Low: z.string(),
	Medium: z.string(),
	"Very high": z.string(),
	"Very low": z.string(),
});

export type RankExplanations = z.infer<typeof rankExplanationsSchema>;

export const createPriorityCriterionPayloadSchema = z
	.object({
		description: z.string().optional(),
		name: z.string().optional(),
		projectId: z.string().min(1),
		rankExplanations: rankExplanationsSchema.optional(),
	})
	.strict();

export type CreatePriorityCriterionPayload = z.infer<
	typeof createPriorityCriterionPayloadSchema
>;

export const createPriorityCriterionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createPriorityCriterionPayloadSchema,
});

export type CreatePriorityCriterionCommand = z.infer<
	typeof createPriorityCriterionCommandSchema
>;

export const updatePriorityCriterionPayloadSchema = z
	.object({
		criterionId: z.string().min(1),
		description: z.string().optional(),
		enabled: z.boolean().optional(),
		name: z.string().optional(),
		rankExplanations: rankExplanationsSchema.optional(),
	})
	.strict();

export const updatePriorityCriterionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: updatePriorityCriterionPayloadSchema,
});

export type UpdatePriorityCriterionCommand = z.infer<
	typeof updatePriorityCriterionCommandSchema
>;

export const trashPriorityCriterionPayloadSchema = z
	.object({
		criterionId: z.string().min(1),
	})
	.strict();

export const trashPriorityCriterionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: trashPriorityCriterionPayloadSchema,
});

export type TrashPriorityCriterionCommand = z.infer<
	typeof trashPriorityCriterionCommandSchema
>;

export const priorityCriterionDefinitionSchema = z.object({
	description: z.string(),
	enabled: z.boolean(),
	id: z.string().min(1),
	name: z.string().min(1),
	preparedKind: z.literal(PRIORITY_COPY.evidenceStrength).nullable(),
	projectId: z.string().min(1),
	rankExplanations: rankExplanationsSchema,
	revision: z.number().int().positive(),
});

export type PriorityCriterionDefinitionView = z.infer<
	typeof priorityCriterionDefinitionSchema
>;

export const priorityCriterionValueSchema = z.object({
	criterionId: z.string().min(1),
	enabled: z.boolean(),
	name: z.string().min(1),
	notEvaluated: z.boolean(),
	rank: z.enum(PRIORITY_RANKS).nullable(),
	rankExplanations: rankExplanationsSchema,
	revision: z.number().int().nonnegative(),
	workId: z.string().min(1),
});

export type PriorityCriterionValueView = z.infer<
	typeof priorityCriterionValueSchema
>;

export const setPriorityCriterionValuePayloadSchema = z
	.object({
		criterionId: z.string().min(1),
		rank: z.enum(PRIORITY_RANKS).nullable(),
		workId: z.string().min(1),
	})
	.strict();

export const setPriorityCriterionValueCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setPriorityCriterionValuePayloadSchema,
});

export type SetPriorityCriterionValueCommand = z.infer<
	typeof setPriorityCriterionValueCommandSchema
>;

export const PRIORITY_REJECTION_REASONS = [
	"criterion-not-effective",
	"formula-not-supported",
	"missing-idempotency-key",
	"missing-name",
	"target-not-found",
	"unknown-rank",
	"session-closed",
] as const;

export type PriorityRejectionReason =
	(typeof PRIORITY_REJECTION_REASONS)[number];

export type PriorityCriterionOutcome =
	| { definition: PriorityCriterionDefinitionView; status: "committed" }
	| { definition: PriorityCriterionDefinitionView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: PriorityRejectionReason; status: "rejected" };

export type PriorityCriterionValueOutcome =
	| { status: "committed"; value: PriorityCriterionValueView }
	| { status: "replayed"; value: PriorityCriterionValueView }
	| { conflict: string; status: "conflict" }
	| { reason: PriorityRejectionReason; status: "rejected" };

export function isPriorityRank(value: string): value is PriorityRank {
	return (PRIORITY_RANKS as readonly string[]).includes(value);
}

export function emptyRankExplanations(): RankExplanations {
	return { ...EMPTY_RANK_EXPLANATIONS };
}

export function priorityCatalog() {
	return {
		copy: PRIORITY_COPY,
		independentManualRankViews: [
			PRIORITY_COPY.createPrioritizationSession,
		] as const,
		preparedCriterion: PRIORITY_COPY.evidenceStrength,
		ranks: PRIORITY_RANKS,
	} as const;
}

export const createPrioritizationSessionPayloadSchema = z
	.object({
		name: z.string().optional(),
		projectId: z.string().min(1),
		workIds: z.array(z.string().min(1)).optional(),
	})
	.strict();

export type CreatePrioritizationSessionPayload = z.infer<
	typeof createPrioritizationSessionPayloadSchema
>;

export const createPrioritizationSessionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createPrioritizationSessionPayloadSchema,
});

export type CreatePrioritizationSessionCommand = z.infer<
	typeof createPrioritizationSessionCommandSchema
>;

export const reorderPrioritizationSessionPayloadSchema = z
	.object({
		sessionId: z.string().min(1),
		workIds: z.array(z.string().min(1)),
	})
	.strict();

export const reorderPrioritizationSessionCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: reorderPrioritizationSessionPayloadSchema,
});

export type ReorderPrioritizationSessionCommand = z.infer<
	typeof reorderPrioritizationSessionCommandSchema
>;

export const setPrioritizationSessionScopePayloadSchema = z
	.object({
		sessionId: z.string().min(1),
		workIds: z.array(z.string().min(1)),
	})
	.strict();

export const setPrioritizationSessionScopeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: setPrioritizationSessionScopePayloadSchema,
});

export type SetPrioritizationSessionScopeCommand = z.infer<
	typeof setPrioritizationSessionScopeCommandSchema
>;

export const sessionIdPayloadSchema = z
	.object({
		sessionId: z.string().min(1),
	})
	.strict();

export const closePrioritizationSessionCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: sessionIdPayloadSchema,
});

export type ClosePrioritizationSessionCommand = z.infer<
	typeof closePrioritizationSessionCommandSchema
>;

export const reopenPrioritizationSessionCommandSchema =
	closePrioritizationSessionCommandSchema;
export type ReopenPrioritizationSessionCommand =
	ClosePrioritizationSessionCommand;

export const trashPrioritizationSessionCommandSchema =
	closePrioritizationSessionCommandSchema;
export type TrashPrioritizationSessionCommand =
	ClosePrioritizationSessionCommand;

export const archivePrioritizationSessionCommandSchema =
	closePrioritizationSessionCommandSchema;
export type ArchivePrioritizationSessionCommand =
	ClosePrioritizationSessionCommand;

export const sessionEvidenceSchema = z.object({
	feedbackRecords: z.number().int().nonnegative(),
	uniqueCompanies: z.number().int().nonnegative(),
	uniqueContacts: z.number().int().nonnegative(),
});

export const sessionCardSchema = z.object({
	backlogRank: z.number().int().nonnegative(),
	criterionValues: z.array(
		z.object({
			criterionId: z.string().min(1),
			name: z.string().min(1),
			notEvaluated: z.boolean(),
			rank: z.enum(PRIORITY_RANKS).nullable(),
		})
	),
	evidence: sessionEvidenceSchema,
	riskCount: z.number().int().nonnegative(),
	sessionRank: z.number().int().nonnegative(),
	targetDate: z.string().nullable(),
	title: z.string(),
	workId: z.string().min(1),
});

export type PrioritizationSessionCardView = z.infer<typeof sessionCardSchema>;

export const prioritizationSessionViewSchema = z.object({
	archivedAt: z.string().nullable(),
	cards: z.array(sessionCardSchema),
	closedAt: z.string().nullable(),
	comparison: z.object({
		backlogOrder: z.array(z.string().min(1)),
		implicitSync: z.literal(false),
		sessionOrder: z.array(z.string().min(1)),
	}),
	createdAt: z.string().min(1),
	id: z.string().min(1),
	name: z.string().min(1),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	writes: z.object({
		backlogOrder: z.literal(false),
		criterionValues: z.literal(false),
		dailyFocus: z.literal(false),
		decisionRecord: z.literal(false),
		focusPeriod: z.literal(false),
		roadmapHorizon: z.literal(false),
		sessionScore: z.literal(false),
		status: z.literal(false),
	}),
});

export type PrioritizationSessionView = z.infer<
	typeof prioritizationSessionViewSchema
>;

export type PrioritizationSessionOutcome =
	| { session: PrioritizationSessionView; status: "committed" }
	| { session: PrioritizationSessionView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: PriorityRejectionReason; status: "rejected" };

export const priorityMetricSummarySchema = z.object({
	enabled: z.boolean(),
	id: z.string().min(1),
	name: z.string().min(1),
	preparedKind: z.literal(PRIORITY_COPY.evidenceStrength).nullable(),
});

export type PriorityMetricSummary = z.infer<typeof priorityMetricSummarySchema>;
