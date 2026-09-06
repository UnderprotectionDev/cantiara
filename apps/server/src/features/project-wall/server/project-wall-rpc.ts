import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createProjectWall,
	getProjectWall,
	listProjectWalls,
	placeLiveCard,
	updateCardDensity,
	updateCardLayout,
} from "./project-wall";
import {
	createProjectWallPayloadSchema,
	placeLiveCardPayloadSchema,
	projectWallCatalog,
	updateCardDensityPayloadSchema,
	updateCardLayoutPayloadSchema,
} from "./project-wall-model";

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

async function requireWall(workspaceId: string, wallId: string) {
	const wall = await getProjectWall(getPrismaClient(), wallId);
	if (!wall) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, wall.projectId);
	return wall;
}

export const projectWall = {
	catalog: protectedProcedure.handler(() => projectWallCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createProjectWallPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.payload.projectId) {
				await requireProject(access.workspaceId, input.payload.projectId);
			}
			return await createProjectWall(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ wallId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireWall(access.workspaceId, input.wallId);
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listProjectWalls(getPrismaClient(), input.projectId);
		}),
	placeLiveCard: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: placeLiveCardPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await placeLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	updateDensity: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: updateCardDensityPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await updateCardDensity(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	updateLayout: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: updateCardLayoutPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWall(access.workspaceId, input.payload.wallId);
			return await updateCardLayout(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
