import { z } from "zod";

import { BLOCKER_STATES, RECORD_KINDS } from "./relations-catalog";

export const recordRefSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(RECORD_KINDS),
	workType: z.string().min(1).optional(),
});

export const originLocationSchema = z.object({
	componentId: z.string().min(1),
	ownerId: z.string().min(1),
	ownerKind: z.enum(RECORD_KINDS),
	sourceVersion: z.string().min(1),
});

export const createRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	blockerState: z.enum(BLOCKER_STATES).optional(),
	from: recordRefSchema,
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	originLocation: originLocationSchema.optional(),
	previewAcknowledged: z.boolean().optional(),
	to: recordRefSchema,
	type: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export type CreateRelationCommand = z.infer<typeof createRelationCommandSchema>;

export const previewRelationInputSchema = z.object({
	from: recordRefSchema,
	originLocation: originLocationSchema.optional(),
	to: recordRefSchema,
	type: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export const deleteRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	relationId: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export type DeleteRelationCommand = z.infer<typeof deleteRelationCommandSchema>;

export const undoRelationCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	relationId: z.string().min(1),
	viewerWorkspaceId: z.string().min(1),
});

export type UndoRelationCommand = z.infer<typeof undoRelationCommandSchema>;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
