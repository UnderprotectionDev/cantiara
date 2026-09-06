import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	addColorSwatch,
	addMoodboardVisual,
	addPaletteGroup,
	createMoodboard,
	getMoodboard,
	getMoodboardByVisualId,
	listMoodboards,
	setMoodboardCaption,
} from "./moodboards";
import {
	addColorSwatchPayloadSchema,
	addMoodboardVisualPayloadSchema,
	addPaletteGroupPayloadSchema,
	createMoodboardPayloadSchema,
	moodboardsCatalog,
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
	addColorSwatch: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: addColorSwatchPayloadSchema,
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
			return await addColorSwatch(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	addPaletteGroup: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: addPaletteGroupPayloadSchema,
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
			return await addPaletteGroup(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
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
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listMoodboards(getPrismaClient(), input.projectId);
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
