import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	getHorizonPlacement,
	listRoadmap,
	placeHorizon,
	saveRoadmapNamedView,
} from "./roadmap-horizon";
import {
	listRoadmapQuerySchema,
	placeHorizonCommandSchema,
	roadmapCatalog,
	saveRoadmapNamedViewCommandSchema,
} from "./roadmap-horizon-model";

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

export const roadmapHorizon = {
	catalog: protectedProcedure.handler(() => roadmapCatalog()),
	list: protectedProcedure
		.input(listRoadmapQuerySchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			const view = await listRoadmap(getPrismaClient(), input);
			if ("reason" in view) {
				throw new ORPCError("NOT_FOUND");
			}
			return view;
		}),
	place: protectedWriteProcedure
		.input(placeHorizonCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await placeHorizon(getPrismaClient(), input);
		}),
	placement: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await getHorizonPlacement(getPrismaClient(), input.workId);
		}),
	saveNamedView: protectedWriteProcedure
		.input(saveRoadmapNamedViewCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await saveRoadmapNamedView(getPrismaClient(), input);
		}),
};
