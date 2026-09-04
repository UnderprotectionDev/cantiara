import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	addException,
	createNamedView,
	createSmartCollection,
	createWorkFromCollection,
	listSmartCollections,
	pinMember,
	previewDragForRecord,
	saveAsNamedView,
	saveNamedView,
	updateSmartCollectionConditions,
	viewSmartCollection,
} from "./smart-collections";
import {
	CONDITION_FIELDS,
	CONDITION_OPERATORS,
	PRESENTATIONS,
	smartCollectionsCatalog,
} from "./smart-collections-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

const conditionSchema = z.object({
	field: z.enum(CONDITION_FIELDS),
	operator: z.enum(CONDITION_OPERATORS),
	value: z.string().min(1),
});

const draftSchema = z.object({
	filterText: z.string(),
	groupField: z.string().min(1).nullable(),
	presentation: z.enum(PRESENTATIONS),
	sortDirection: z.enum(["asc", "desc"]).nullable(),
	sortField: z.string().min(1).nullable(),
	visibleFields: z.array(z.string().min(1)),
});

const defineInput = z.object({
	conditions: z.array(conditionSchema),
	name: z.string(),
	projectId: z.string().min(1).nullable(),
	sourceKind: z.string().min(1),
});

export const smartCollections = {
	catalog: protectedProcedure.handler(() => smartCollectionsCatalog()),
	create: protectedWriteProcedure
		.input(defineInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createSmartCollection(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	createNamedView: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				draft: draftSchema.optional(),
				name: z.string(),
				purpose: z.string().nullable().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createNamedView(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listSmartCollections(getPrismaClient(), access.workspaceId);
	}),
	newWork: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				draft: z.object({
					projectId: z.string().min(1).optional(),
					status: z.string().min(1).optional(),
					title: z.string().min(1),
					type: z.string().min(1).optional(),
				}),
				idempotencyKey: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createWorkFromCollection(getPrismaClient(), {
				actorId: access.accountId,
				collectionId: input.collectionId,
				draft: input.draft,
				idempotencyKey: input.idempotencyKey,
				workspaceId: access.workspaceId,
			});
		}),
	pin: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				recordId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const view = await viewSmartCollection(
				getPrismaClient(),
				access.workspaceId,
				input.collectionId
			);
			if (!view) {
				throw new ORPCError("NOT_FOUND");
			}
			return pinMember(view.collection, input.recordId);
		}),
	previewDrag: protectedProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				recordId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewDragForRecord(
				getPrismaClient(),
				access.workspaceId,
				input.collectionId,
				input.recordId
			);
		}),
	refuseException: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				recordId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const view = await viewSmartCollection(
				getPrismaClient(),
				access.workspaceId,
				input.collectionId
			);
			if (!view) {
				throw new ORPCError("NOT_FOUND");
			}
			return addException(view.collection, input.recordId);
		}),
	saveAsNamedView: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				draft: draftSchema,
				name: z.string(),
				purpose: z.string().nullable().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await saveAsNamedView(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	saveNamedView: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				draft: draftSchema,
				purpose: z.string().nullable().optional(),
				viewId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await saveNamedView(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	update: protectedWriteProcedure
		.input(
			z.object({
				collectionId: z.string().min(1),
				conditions: z.array(conditionSchema),
				name: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await updateSmartCollectionConditions(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	view: protectedProcedure
		.input(z.object({ collectionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const view = await viewSmartCollection(
				getPrismaClient(),
				access.workspaceId,
				input.collectionId
			);
			if (!view) {
				throw new ORPCError("NOT_FOUND");
			}
			return view;
		}),
};
