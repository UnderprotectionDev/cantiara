import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	archiveScreen,
	createScreen,
	getScreen,
	listScreens,
	permanentlyDeleteScreen,
	restoreScreen,
	saveExactWireframeVersion,
	trashScreen,
	unarchiveScreen,
} from "./screens-and-wireframes";
import {
	createScreenPayloadSchema,
	emptyWireframeDocumentSchema,
	SCREENS_COPY,
} from "./screens-and-wireframes-model";

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

async function requireScreen(workspaceId: string, screenId: string) {
	const screen = await getScreen(getPrismaClient(), screenId);
	if (!screen) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, screen.projectId);
	return screen;
}

const screenCommandInput = z.object({
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string(),
	screenId: z.string().min(1),
});

export const screensAndWireframes = {
	archive: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await archiveScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	catalog: protectedProcedure.handler(() => SCREENS_COPY),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ screenId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireScreen(access.workspaceId, input.screenId);
		}),
	list: protectedProcedure
		.input(
			z.object({
				includeArchived: z.boolean().optional(),
				projectId: z.string().min(1),
				trash: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listScreens(getPrismaClient(), input);
		}),
	permanentlyDelete: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await permanentlyDeleteScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	restore: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await restoreScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	saveVersion: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().positive(),
				document: emptyWireframeDocumentSchema,
				idempotencyKey: z.string(),
				screenId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await saveExactWireframeVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: {
					document: input.document,
					screenId: input.screenId,
				},
			});
		}),
	trash: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await trashScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	unarchive: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await unarchiveScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
};
