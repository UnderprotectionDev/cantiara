import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	addMoodboardVisual,
	createMoodboard,
	exportMoodboardSnapshot,
	getMoodboard,
	getMoodboardByVisualId,
	listMoodboards,
	presentMoodboard,
	previewMoodboardSnapshot,
	setMoodboardCaption,
	setMoodboardFocusOrder,
	setMoodboardViewTransform,
} from "./moodboards";
import {
	addMoodboardVisualPayloadSchema,
	createMoodboardPayloadSchema,
	moodboardSnapshotScopeSchema,
	moodboardsCatalog,
	setMoodboardCaptionPayloadSchema,
	setMoodboardFocusOrderPayloadSchema,
	setMoodboardViewTransformPayloadSchema,
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

async function requireMoodboard(workspaceId: string, moodboardId: string) {
	const moodboard = await getMoodboard(getPrismaClient(), moodboardId);
	if (!moodboard) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, moodboard.projectId);
	return moodboard;
}

function snapshotWire(
	outcome: Awaited<ReturnType<typeof exportMoodboardSnapshot>>
) {
	if (outcome.status !== "ok") {
		return outcome;
	}
	return {
		snapshot: {
			...outcome.snapshot,
			files: outcome.snapshot.files.map((file) => ({
				bytesBase64: Buffer.from(file.bytes).toString("base64"),
				filename: file.filename,
				mimeType: file.mimeType,
				pageCount: file.pageCount,
				visualId: file.visualId,
			})),
		},
		status: "ok" as const,
	};
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
			await requireMoodboard(access.workspaceId, input.payload.moodboardId);
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
	exportSnapshot: protectedProcedure
		.input(moodboardSnapshotScopeSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireMoodboard(access.workspaceId, input.moodboardId);
			return snapshotWire(
				await exportMoodboardSnapshot(getPrismaClient(), input)
			);
		}),
	get: protectedProcedure
		.input(z.object({ moodboardId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const moodboard = await requireMoodboard(
				access.workspaceId,
				input.moodboardId
			);
			return moodboard;
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listMoodboards(getPrismaClient(), input.projectId);
		}),
	present: protectedProcedure
		.input(
			z.object({
				moodboardId: z.string().min(1),
				presentationMode: z.boolean(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireMoodboard(access.workspaceId, input.moodboardId);
			const presented = await presentMoodboard(getPrismaClient(), input);
			if (!presented) {
				throw new ORPCError("NOT_FOUND");
			}
			return presented;
		}),
	previewSnapshot: protectedProcedure
		.input(moodboardSnapshotScopeSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireMoodboard(access.workspaceId, input.moodboardId);
			return await previewMoodboardSnapshot(getPrismaClient(), input);
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
	setFocusOrder: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setMoodboardFocusOrderPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireMoodboard(access.workspaceId, input.payload.moodboardId);
			return await setMoodboardFocusOrder(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setViewTransform: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setMoodboardViewTransformPayloadSchema,
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
			return await setMoodboardViewTransform(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
