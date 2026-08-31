import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	listPreparedBacklog,
	placeOnPlanningSurface,
	reorderManualOrder,
	saveBacklogPresentation,
	takeUpFromBacklog,
} from "./backlog";
import { backlogCatalog, backlogSortSchema } from "./backlog-model";

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

async function requireWork(workspaceId: string, workId: string) {
	const work = await getWork(getPrismaClient(), workId);
	if (!work) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, work.projectId);
	return work;
}

export const backlog = {
	catalog: protectedProcedure.handler(() => backlogCatalog()),
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				sort: backlogSortSchema.optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listPreparedBacklog(getPrismaClient(), input.projectId, {
				sort: input.sort,
			});
		}),
	placeOnSurface: protectedWriteProcedure
		.input(
			z.object({
				surface: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await placeOnPlanningSurface(getPrismaClient(), input);
		}),
	reorder: protectedWriteProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				workIds: z.array(z.string().min(1)),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await reorderManualOrder(getPrismaClient(), input);
		}),
	savePresentation: protectedWriteProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				sort: backlogSortSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await saveBacklogPresentation(getPrismaClient(), input);
		}),
	takeUp: protectedWriteProcedure
		.input(
			z.object({
				onto: z.string().min(1).optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await takeUpFromBacklog(getPrismaClient(), input);
		}),
};
