import { z } from "zod";

export const BLOCKERS_COPY = {
	active: "Active",
	blockedBy: "Blocked by",
	blocks: "Blocks",
	removeRelation: "Remove relation",
} as const;

export const BLOCKER_SOURCE_KINDS = ["Work", "Decision", "Question"] as const;

export type BlockerSourceKind = (typeof BLOCKER_SOURCE_KINDS)[number];

export const blockerSourceRefSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(BLOCKER_SOURCE_KINDS),
});

export type BlockerSourceRef = z.infer<typeof blockerSourceRefSchema>;

export const blockingRelationViewSchema = z.object({
	blockedWorkId: z.string().min(1),
	copy: z.object({
		active: z.literal(BLOCKERS_COPY.active),
		removeRelation: z.literal(BLOCKERS_COPY.removeRelation),
	}),
	id: z.string().min(1),
	source: blockerSourceRefSchema,
	state: z.literal(BLOCKERS_COPY.active),
	type: z.literal(BLOCKERS_COPY.blocks),
	typeLabelFrom: z.literal(BLOCKERS_COPY.blocks),
	typeLabelTo: z.literal(BLOCKERS_COPY.blockedBy),
});

export type BlockingRelationView = z.infer<typeof blockingRelationViewSchema>;

export const workBlockersViewSchema = z.object({
	copy: z.object({
		active: z.literal(BLOCKERS_COPY.active),
		removeRelation: z.literal(BLOCKERS_COPY.removeRelation),
	}),
	hasActiveBlocker: z.boolean(),
	relations: z.array(blockingRelationViewSchema),
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

export type WorkBlockersWriteOutcome =
	| { relation: BlockingRelationView; status: "committed" }
	| { relation: BlockingRelationView; status: "replayed" }
	| { conflict: string; status: "conflict" }
	| { reason: string; status: "rejected" };
