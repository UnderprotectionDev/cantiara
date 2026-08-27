import { z } from "zod";

export const WORK_TYPES = [
	"Feature",
	"Bug",
	"Task",
	"Research",
	"Improvement",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const DEFAULT_WORK_TYPE = "Task" as const satisfies WorkType;

export const WORK_STATUS = {
	notStarted: "Not Started",
} as const;

export const WORK_LIFECYCLE_COPY = {
	changeType: "Change type",
	confirmTypeChange: "Confirm type change",
	createWork: "Create Work",
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	key: "Key",
	noWork: "No Work yet.",
	primarySpec: "Primary spec",
	title: "Title",
	type: "Type",
	work: "Work",
} as const;

export const workTypeSchema = z.enum(WORK_TYPES);

export const workViewSchema = z.object({
	id: z.string().min(1),
	key: z.string().min(1),
	number: z.number().int().positive(),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	status: z.literal(WORK_STATUS.notStarted),
	title: z.string().min(1),
	type: workTypeSchema,
});

export type WorkView = z.infer<typeof workViewSchema>;

export const WORK_CREATE_SOURCES = [
	"create",
	"draft-finalize",
	"capture-convert",
] as const;

export type WorkCreateSource = (typeof WORK_CREATE_SOURCES)[number];

export const createWorkPayloadSchema = z.object({
	projectId: z.string().min(1),
	source: z.enum(WORK_CREATE_SOURCES).optional(),
	title: z.string().optional(),
	type: z.string().optional(),
});

export type CreateWorkPayload = z.infer<typeof createWorkPayloadSchema>;

export const createWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createWorkPayloadSchema,
});

export type CreateWorkCommand = z.infer<typeof createWorkCommandSchema>;

export const updateWorkTitleCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	title: z.string(),
	workId: z.string().min(1),
});

export type UpdateWorkTitleCommand = z.infer<
	typeof updateWorkTitleCommandSchema
>;

export const changeWorkTypeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	previewAcknowledged: z.boolean().optional(),
	type: z.string(),
	workId: z.string().min(1),
});

export type ChangeWorkTypeCommand = z.infer<typeof changeWorkTypeCommandSchema>;

export const typeChangeImpactSchema = z.object({
	blocked: z.boolean(),
	copy: z.object({
		detachBeforeLeavingFeature: z.literal(
			WORK_LIFECYCLE_COPY.detachBeforeLeavingFeature
		),
		featureHealth: z.literal(WORK_LIFECYCLE_COPY.featureHealth),
		impactPreview: z.literal(WORK_LIFECYCLE_COPY.impactPreview),
		includedWork: z.literal(WORK_LIFECYCLE_COPY.includedWork),
		primarySpec: z.literal(WORK_LIFECYCLE_COPY.primarySpec),
	}),
	fromType: workTypeSchema,
	healthHistory: z.array(z.object({ id: z.string().min(1) })),
	includedWork: z.array(
		z.object({
			id: z.string().min(1),
			key: z.string().min(1),
			title: z.string().min(1),
		})
	),
	primarySpec: z
		.object({
			id: z.string().min(1),
			title: z.string().min(1),
		})
		.nullable(),
	requiresPreview: z.boolean(),
	toType: workTypeSchema,
});

export type TypeChangeImpact = z.infer<typeof typeChangeImpactSchema>;

export type WorkLifecycleRejectionReason =
	| "feature-exit-blocked"
	| "feature-impact-preview-required"
	| "missing-idempotency-key"
	| "missing-title"
	| "target-not-found"
	| "unknown-work-type"
	| "work-not-portable";

export type WorkLifecycleOutcome =
	| { status: "committed"; work: WorkView }
	| { status: "replayed"; work: WorkView }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			current: WorkView;
			currentValueLabel: "Current value";
			status: "stale";
	  }
	| {
			reason: WorkLifecycleRejectionReason;
			status: "rejected";
	  };

export function isWorkType(value: string): value is WorkType {
	return (WORK_TYPES as readonly string[]).includes(value);
}

export function involvesFeature(fromType: WorkType, toType: WorkType): boolean {
	return (
		fromType !== toType && (fromType === "Feature" || toType === "Feature")
	);
}

export function typeChangeImpact(
	fromType: WorkType,
	toType: WorkType,
	attachments: {
		healthHistory?: TypeChangeImpact["healthHistory"];
		includedWork?: TypeChangeImpact["includedWork"];
		primarySpec?: TypeChangeImpact["primarySpec"];
	} = {}
): TypeChangeImpact {
	const includedWork = attachments.includedWork ?? [];
	const healthHistory = attachments.healthHistory ?? [];
	const primarySpec = attachments.primarySpec ?? null;
	const leavingFeature = fromType === "Feature" && toType !== "Feature";
	const blocked =
		leavingFeature &&
		(includedWork.length > 0 ||
			healthHistory.length > 0 ||
			primarySpec !== null);
	return {
		blocked,
		copy: {
			detachBeforeLeavingFeature:
				WORK_LIFECYCLE_COPY.detachBeforeLeavingFeature,
			featureHealth: WORK_LIFECYCLE_COPY.featureHealth,
			impactPreview: WORK_LIFECYCLE_COPY.impactPreview,
			includedWork: WORK_LIFECYCLE_COPY.includedWork,
			primarySpec: WORK_LIFECYCLE_COPY.primarySpec,
		},
		fromType,
		healthHistory,
		includedWork,
		primarySpec,
		requiresPreview: involvesFeature(fromType, toType),
		toType,
	};
}

export function workKey(shortCode: string, number: number): string {
	return `${shortCode}-${number}`;
}

export function optionalText(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}
