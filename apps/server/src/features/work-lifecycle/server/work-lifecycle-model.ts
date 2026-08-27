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
	blocked: "Blocked",
	closed: "Closed",
	inProgress: "In Progress",
	notStarted: "Not Started",
} as const;

export const WORK_STATUSES = [
	WORK_STATUS.notStarted,
	WORK_STATUS.inProgress,
	WORK_STATUS.blocked,
	WORK_STATUS.closed,
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const NON_TERMINAL_WORK_STATUSES = [
	WORK_STATUS.notStarted,
	WORK_STATUS.inProgress,
	WORK_STATUS.blocked,
] as const;

export type NonTerminalWorkStatus = (typeof NON_TERMINAL_WORK_STATUSES)[number];

export const CLOSURE_RESULT = {
	abandoned: "Abandoned",
	completed: "Completed",
} as const;

export const CLOSURE_RESULTS = [
	CLOSURE_RESULT.completed,
	CLOSURE_RESULT.abandoned,
] as const;

export type ClosureResult = (typeof CLOSURE_RESULTS)[number];

export const WORK_LIFECYCLE_COPY = {
	abandoned: CLOSURE_RESULT.abandoned,
	archive: "Archive",
	archived: "Archived",
	blocked: WORK_STATUS.blocked,
	changeType: "Change type",
	closeAnyway: "Close anyway",
	closed: WORK_STATUS.closed,
	closureCheck: "Closure check",
	completed: CLOSURE_RESULT.completed,
	confirmReopen: "Confirm reopen",
	confirmTypeChange: "Confirm type change",
	createWork: "Create Work",
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	inProgress: WORK_STATUS.inProgress,
	keepLastingContext: "Keep lasting context",
	key: "Key",
	notStarted: WORK_STATUS.notStarted,
	noWork: "No Work yet.",
	primarySpec: "Primary spec",
	reason: "Reason",
	reopen: "Reopen",
	returnToWork: "Return to work",
	title: "Title",
	type: "Type",
	unarchive: "Unarchive",
	work: "Work",
} as const;

export const workTypeSchema = z.enum(WORK_TYPES);
export const workStatusSchema = z.enum(WORK_STATUSES);
export const nonTerminalWorkStatusSchema = z.enum(NON_TERMINAL_WORK_STATUSES);
export const closureResultSchema = z.enum(CLOSURE_RESULTS);

export const workViewSchema = z.object({
	archived: z.boolean().default(false),
	closureResult: closureResultSchema.nullable().default(null),
	id: z.string().min(1),
	key: z.string().min(1),
	number: z.number().int().positive(),
	projectId: z.string().min(1),
	revision: z.number().int().positive(),
	status: workStatusSchema,
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

export const changeWorkStatusCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.string(),
	status: z.string(),
	workId: z.string().min(1),
});

export type ChangeWorkStatusCommand = z.infer<
	typeof changeWorkStatusCommandSchema
>;

export const closeWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.string(),
	reason: z.string().optional(),
	result: z.string().optional(),
	workId: z.string().min(1),
});

export type CloseWorkCommand = z.infer<typeof closeWorkCommandSchema>;

export const reopenWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.string(),
	reopenConfirmed: z.boolean().optional(),
	status: z.string(),
	workId: z.string().min(1),
});

export type ReopenWorkCommand = z.infer<typeof reopenWorkCommandSchema>;

export const archiveWorkCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	workId: z.string().min(1),
});

export type ArchiveWorkCommand = z.infer<typeof archiveWorkCommandSchema>;

export const unarchiveWorkCommandSchema = archiveWorkCommandSchema;

export type UnarchiveWorkCommand = z.infer<typeof unarchiveWorkCommandSchema>;

export const applyPlanningMembershipCommandSchema = z.object({
	desiredStatus: z.string().optional(),
	surface: z.string().min(1),
	workId: z.string().min(1),
});

export type ApplyPlanningMembershipCommand = z.infer<
	typeof applyPlanningMembershipCommandSchema
>;

export const closePreviewFindingSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
});

export const previewCloseInputSchema = z.object({
	activeBlockers: z.array(closePreviewFindingSchema).optional(),
	incompleteChecklistItems: z.array(closePreviewFindingSchema).optional(),
	notes: z.string().optional(),
	workId: z.string().min(1),
});

export type PreviewCloseInput = z.infer<typeof previewCloseInputSchema>;

export const keepLastingContextPreviewSchema = z.object({
	decision: z.object({
		action: z.literal("create-decision"),
		body: z.string(),
		linkedWorkId: z.string().min(1),
	}),
	personalWiki: z.object({
		action: z.literal("create-personal-wiki-document"),
		body: z.string(),
		originProjectId: z.string().min(1),
		originWorkId: z.string().min(1),
	}),
});

export const closePreviewSchema = z.object({
	blocking: z.literal(false),
	copy: z.object({
		abandoned: z.literal(WORK_LIFECYCLE_COPY.abandoned),
		closeAnyway: z.literal(WORK_LIFECYCLE_COPY.closeAnyway),
		closureCheck: z.literal(WORK_LIFECYCLE_COPY.closureCheck),
		completed: z.literal(WORK_LIFECYCLE_COPY.completed),
		keepLastingContext: z.literal(WORK_LIFECYCLE_COPY.keepLastingContext),
		returnToWork: z.literal(WORK_LIFECYCLE_COPY.returnToWork),
	}),
	findings: z.object({
		activeBlockers: z.array(closePreviewFindingSchema),
		incompleteChecklistItems: z.array(closePreviewFindingSchema),
	}),
	keepLastingContext: keepLastingContextPreviewSchema.nullable(),
});

export type ClosePreview = z.infer<typeof closePreviewSchema>;

export const workLifecycleEventSchema = z.object({
	closureResult: closureResultSchema.nullable(),
	id: z.string().min(1),
	kind: z.enum(["status", "closed", "reopened"]),
	reason: z.string().nullable(),
	status: workStatusSchema,
});

export type WorkLifecycleEventView = z.infer<typeof workLifecycleEventSchema>;

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
	| "close-step-required"
	| "feature-exit-blocked"
	| "feature-impact-preview-required"
	| "missing-idempotency-key"
	| "missing-title"
	| "reopen-confirm-required"
	| "reopen-required"
	| "silent-result-forbidden"
	| "target-not-found"
	| "unknown-closure-result"
	| "unknown-work-status"
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

export type PlanningMembershipOutcome =
	| { membership: { surface: string }; status: "committed"; work: WorkView }
	| { reason: WorkLifecycleRejectionReason; status: "rejected" };

export function isWorkType(value: string): value is WorkType {
	return (WORK_TYPES as readonly string[]).includes(value);
}

export function isWorkStatus(value: string): value is WorkStatus {
	return (WORK_STATUSES as readonly string[]).includes(value);
}

export function isNonTerminalWorkStatus(
	value: string
): value is NonTerminalWorkStatus {
	return (NON_TERMINAL_WORK_STATUSES as readonly string[]).includes(value);
}

export function isClosureResult(value: string): value is ClosureResult {
	return (CLOSURE_RESULTS as readonly string[]).includes(value);
}

export function closePreviewCopy() {
	return {
		abandoned: WORK_LIFECYCLE_COPY.abandoned,
		closeAnyway: WORK_LIFECYCLE_COPY.closeAnyway,
		closureCheck: WORK_LIFECYCLE_COPY.closureCheck,
		completed: WORK_LIFECYCLE_COPY.completed,
		keepLastingContext: WORK_LIFECYCLE_COPY.keepLastingContext,
		returnToWork: WORK_LIFECYCLE_COPY.returnToWork,
	} as const;
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
