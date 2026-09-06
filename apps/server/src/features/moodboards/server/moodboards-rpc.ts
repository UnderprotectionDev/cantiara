import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	addMoodboardVisual,
	createMoodboard,
	getMoodboard,
	getMoodboardByVisualId,
	getPersonalViewport,
	groupOutline,
	listMoodboards,
	reorderOutline,
	savePersonalViewport,
	setMoodboardCaption,
} from "./moodboards";
import {
	addMoodboardVisualPayloadSchema,
	createMoodboardPayloadSchema,
	groupOutlinePayloadSchema,
	moodboardsCatalog,
	reorderOutlinePayloadSchema,
	savePersonalViewportPayloadSchema,
	setMoodboardCaptionPayloadSchema,
} from "./moodboards-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function requireProject(workspaceId: string, projectId: string) {
	const project = await getProject(getPrismaClient(), projectId);
	if (!project || project.workspaceId !== workspaceId) {
		throw new ORPCError("NOT_FOUND");
	}
	return project;
}

export const moodboards = {
	addVisual: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: addMoodboardVisualPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.payload.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await addMoodboardVisual(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => moodboardsCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createMoodboardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createMoodboard(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ moodboardId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return moodboard;
		}),
	getViewport: protectedProcedure
		.input(z.object({ moodboardId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await getPersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				moodboardId: input.moodboardId,
			});
		}),
	groupOutline: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: groupOutlinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.payload.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await groupOutline(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listMoodboards(getPrismaClient(), input.projectId);
		}),
	reorderOutline: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: reorderOutlinePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.payload.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await reorderOutline(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	saveViewport: protectedWriteProcedure
		.input(z.object({ payload: savePersonalViewportPayloadSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboard(
				getPrismaClient(),
				input.payload.moodboardId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await savePersonalViewport(getPrismaClient(), {
				actorId: context.session.user.id,
				payload: input.payload,
			});
		}),
	setCaption: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setMoodboardCaptionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await getMoodboardByVisualId(
				getPrismaClient(),
				input.payload.visualId
			);
			if (!moodboard) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, moodboard.projectId);
			return await setMoodboardCaption(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
