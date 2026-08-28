import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	createRelation,
	deleteRelation,
	listRelations,
	previewRelation,
	relationsCatalog,
	undoRelation,
} from "./relations";
import { originLocationSchema, recordRefSchema } from "./relations-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const relations = {
	catalog: protectedProcedure.handler(() => relationsCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				from: recordRefSchema,
				idempotencyKey: z.string(),
				originLocation: originLocationSchema.optional(),
				previewAcknowledged: z.boolean().optional(),
				to: recordRefSchema,
				type: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createRelation(getPrismaClient(), {
				actorId: access.accountId,
				from: input.from,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				originLocation: input.originLocation,
				previewAcknowledged: input.previewAcknowledged,
				to: input.to,
				type: input.type,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	delete: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				relationId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await deleteRelation(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				relationId: input.relationId,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	list: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1),
				kind: recordRefSchema.shape.kind,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await listRelations(getPrismaClient(), {
				record: input,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	preview: protectedProcedure
		.input(
			z.object({
				from: recordRefSchema,
				originLocation: originLocationSchema.optional(),
				to: recordRefSchema,
				type: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewRelation(getPrismaClient(), {
				...input,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	undo: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				relationId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await undoRelation(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				relationId: input.relationId,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
};
