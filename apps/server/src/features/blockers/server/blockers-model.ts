import { z } from "zod";

export const BLOCKERS_COPY = {
	active: "Active",
	blockedBy: "Blocked by",
	blocks: "Blocks",
	cycle: "These records wait on each other.",
	dependencies: "Dependencies",
	markBlockerResolved: "Mark blocker resolved",
	note: "Note",
	removeRelation: "Remove relation",
	resolved: "Resolved",
	sourceClosedSuggestion:
		"Source is closed. Mark blocker resolved is a separate act.",
} as const;

export const WORK_BLOCKED_SIGNAL_ID = "work-blocked" as const;

export const WORK_BLOCKED_SIGNAL_SECTION = "Action Required" as const;

export const BLOCKER_SOURCE_KINDS = ["Work", "Decision", "Question"] as const;

export type BlockerSourceKind = (typeof BLOCKER_SOURCE_KINDS)[number];

export const BLOCKER_RELATION_STATES = [
	BLOCKERS_COPY.active,
	BLOCKERS_COPY.resolved,
] as const;

export type BlockerRelationState = (typeof BLOCKER_RELATION_STATES)[number];

export const blockerSourceRefSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(BLOCKER_SOURCE_KINDS),
});

export type BlockerSourceRef = z.infer<typeof blockerSourceRefSchema>;

const blockersCopySchema = z.object({
	active: z.literal(BLOCKERS_COPY.active),
	markBlockerResolved: z.literal(BLOCKERS_COPY.markBlockerResolved),
	removeRelation: z.literal(BLOCKERS_COPY.removeRelation),
	resolved: z.literal(BLOCKERS_COPY.resolved),
});

const sourceCloseSuggestionSchema = z.object({
	copy: z.object({
		markBlockerResolved: z.literal(BLOCKERS_COPY.markBlockerResolved),
	}),
	reason: z.literal(BLOCKERS_COPY.sourceClosedSuggestion),
});

export const blockingRelationViewSchema = z.object({
	blockedWorkId: z.string().min(1),
	copy: blockersCopySchema,
	establishedAt: z.string().min(1),
	id: z.string().min(1),
	resolutionNote: z.string().min(1).nullable(),
	resolvedAt: z.string().min(1).nullable(),
	source: blockerSourceRefSchema,
	sourceCloseSuggestion: sourceCloseSuggestionSchema.nullable(),
	state: z.enum(BLOCKER_RELATION_STATES),
	type: z.literal(BLOCKERS_COPY.blocks),
	typeLabelFrom: z.literal(BLOCKERS_COPY.blocks),
	typeLabelTo: z.literal(BLOCKERS_COPY.blockedBy),
});

export type BlockingRelationView = z.infer<typeof blockingRelationViewSchema>;

export const workBlockedSignalViewSchema = z.object({
	blockedWorkId: z.string().min(1),
	relationId: z.string().min(1),
	relationTime: z.string().min(1),
	section: z.literal(WORK_BLOCKED_SIGNAL_SECTION),
	signalId: z.literal(WORK_BLOCKED_SIGNAL_ID),
	source: blockerSourceRefSchema,
});

export type WorkBlockedSignalView = z.infer<typeof workBlockedSignalViewSchema>;

export const workBlockersViewSchema = z.object({
	copy: blockersCopySchema,
	hasActiveBlocker: z.boolean(),
	relations: z.array(blockingRelationViewSchema),
	signals: z.array(workBlockedSignalViewSchema),
	workId: z.string().min(1),
	workStatus: z.string().min(1),
});

export type WorkBlockersView = z.infer<typeof workBlockersViewSchema>;

export const addActiveBlockingRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	blockedWorkId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	source: blockerSourceRefSchema,
	viewerWorkspaceId: z.string().min(1),
});

export type AddActiveBlockingRelationCommand = z.infer<
	typeof addActiveBlockingRelationCommandSchema
>;

export const removeBlockingRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	relationId: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export type RemoveBlockingRelationCommand = z.infer<
	typeof removeBlockingRelationCommandSchema
>;

export const markBlockerResolvedCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	relationId: z.string().min(1),
	resolutionNote: z.string().optional(),
	viewerWorkspaceId: z.string().min(1),
});

export type MarkBlockerResolvedCommand = z.infer<
	typeof markBlockerResolvedCommandSchema
>;

export const reactivateBlockingRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	relationId: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export type ReactivateBlockingRelationCommand = z.infer<
	typeof reactivateBlockingRelationCommandSchema
>;

export const dependencyNodeSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(BLOCKER_SOURCE_KINDS),
});

export const dependencyEdgeSchema = z.object({
	direction: z.literal(BLOCKERS_COPY.blocks),
	from: blockerSourceRefSchema,
	id: z.string().min(1),
	state: z.enum(BLOCKER_RELATION_STATES),
	to: z.object({
		id: z.string().min(1),
		kind: z.literal("Work"),
	}),
});

export const dependencyCycleSchema = z.object({
	explanation: z.literal(BLOCKERS_COPY.cycle),
	relationIds: z.array(z.string().min(1)),
	workIds: z.array(z.string().min(1)),
});

export const dependenciesProjectionSchema = z.object({
	copy: z.object({
		active: z.literal(BLOCKERS_COPY.active),
		blockedBy: z.literal(BLOCKERS_COPY.blockedBy),
		blocks: z.literal(BLOCKERS_COPY.blocks),
		cycle: z.literal(BLOCKERS_COPY.cycle),
		dependencies: z.literal(BLOCKERS_COPY.dependencies),
		resolved: z.literal(BLOCKERS_COPY.resolved),
	}),
	cycles: z.array(dependencyCycleSchema),
	edges: z.array(dependencyEdgeSchema),
	nodes: z.array(dependencyNodeSchema),
	writable: z.literal(false),
});

export type DependenciesProjection = z.infer<
	typeof dependenciesProjectionSchema
>;

export type WorkBlockersWriteOutcome =
	| {
			emissions: WorkBlockedSignalView[];
			relation: BlockingRelationView;
			status: "committed";
	  }
	| {
			emissions: WorkBlockedSignalView[];
			relation: BlockingRelationView;
			status: "replayed";
	  }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };
