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
	description: "Description",
	enable: "Enable",
	evidenceStrength: "Evidence strength",
	feedback: "Feedback",
	high: "High",
	horizontal: "Horizontal",
	low: "Low",
	medium: "Medium",
	name: "Name",
	nameRequired: "Name is required.",
	priorityMap: "Priority Map",
	priorityMetrics: "Priority metrics",
	rankExplanation: "Rank explanation",
	save: "Save",
	unevaluated: "Unevaluated",
	uniqueCompany: "Unique Company",
	uniqueContact: "Unique Contact",
	unknownRank: "This rank is not one of the five fixed levels.",
	vertical: "Vertical",
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
	"axes-not-distinct",
	"criterion-not-effective",
	"formula-not-supported",
	"missing-idempotency-key",
	"missing-name",
	"position-is-not-order",
	"target-not-found",
	"unknown-rank",
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

export const priorityMapEvidenceSchema = z.object({
	feedbackCount: z.number().int().nonnegative(),
	uniqueCompanyCount: z.number().int().nonnegative(),
	uniqueContactCount: z.number().int().nonnegative(),
});

export type PriorityMapEvidence = z.infer<typeof priorityMapEvidenceSchema>;

export const priorityMapAxisSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
});

export const priorityMapPlottedSchema = z.object({
	evidence: priorityMapEvidenceSchema.nullable(),
	horizontalRank: z.enum(PRIORITY_RANKS),
	key: z.string().min(1),
	title: z.string().min(1),
	verticalRank: z.enum(PRIORITY_RANKS),
	workId: z.string().min(1),
});

export const priorityMapUnevaluatedSchema = z.object({
	evidence: priorityMapEvidenceSchema.nullable(),
	key: z.string().min(1),
	missingAxes: z.array(z.enum(["horizontal", "vertical"])).min(1),
	title: z.string().min(1),
	workId: z.string().min(1),
});

export const priorityMapViewSchema = z.object({
	horizontal: priorityMapAxisSchema,
	plotted: z.array(priorityMapPlottedSchema),
	ranks: z.tuple([
		z.literal("Very low"),
		z.literal("Low"),
		z.literal("Medium"),
		z.literal("High"),
		z.literal("Very high"),
	]),
	unevaluated: z.array(priorityMapUnevaluatedSchema),
	vertical: priorityMapAxisSchema,
});

export type PriorityMapView = z.infer<typeof priorityMapViewSchema>;

export type PriorityMapReadOutcome =
	| { status: "ok"; view: PriorityMapView }
	| { reason: PriorityRejectionReason; status: "rejected" };

export const readPriorityMapInputSchema = z
	.object({
		horizontalCriterionId: z.string().min(1),
		projectId: z.string().min(1),
		verticalCriterionId: z.string().min(1),
	})
	.strict();

export type ReadPriorityMapInput = z.infer<typeof readPriorityMapInputSchema>;

export const savePriorityMapPresentationPayloadSchema = z
	.object({
		horizontalCriterionId: z.string().min(1),
		projectId: z.string().min(1),
		verticalCriterionId: z.string().min(1),
	})
	.strict();

export const savePriorityMapPresentationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: savePriorityMapPresentationPayloadSchema,
});

export type SavePriorityMapPresentationCommand = z.infer<
	typeof savePriorityMapPresentationCommandSchema
>;

export const priorityMapPresentationSchema = z.object({
	horizontalCriterionId: z.string().min(1),
	projectId: z.string().min(1),
	verticalCriterionId: z.string().min(1),
});

export type PriorityMapPresentation = z.infer<
	typeof priorityMapPresentationSchema
>;

export type PriorityMapPresentationOutcome =
	| { presentation: PriorityMapPresentation; status: "committed" }
	| { presentation: PriorityMapPresentation; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: PriorityRejectionReason; status: "rejected" };

export const relocatePriorityMapPointPayloadSchema = z
	.object({
		horizontalRank: z.enum(PRIORITY_RANKS),
		projectId: z.string().min(1),
		verticalRank: z.enum(PRIORITY_RANKS),
		workId: z.string().min(1),
	})
	.strict();

export const relocatePriorityMapPointCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: relocatePriorityMapPointPayloadSchema,
});

export type RelocatePriorityMapPointCommand = z.infer<
	typeof relocatePriorityMapPointCommandSchema
>;

export interface RelocatePriorityMapPointOutcome {
	reason: PriorityRejectionReason;
	status: "rejected";
}

export function isPriorityRank(value: string): value is PriorityRank {
	return (PRIORITY_RANKS as readonly string[]).includes(value);
}

export function emptyRankExplanations(): RankExplanations {
	return { ...EMPTY_RANK_EXPLANATIONS };
}

export function priorityCatalog() {
	return {
		copy: PRIORITY_COPY,
		preparedCriterion: PRIORITY_COPY.evidenceStrength,
		ranks: PRIORITY_RANKS,
	} as const;
}

export const priorityMetricSummarySchema = z.object({
	enabled: z.boolean(),
	id: z.string().min(1),
	name: z.string().min(1),
	preparedKind: z.literal(PRIORITY_COPY.evidenceStrength).nullable(),
});

export type PriorityMetricSummary = z.infer<typeof priorityMetricSummarySchema>;
