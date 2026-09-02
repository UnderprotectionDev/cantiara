import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	contributeToMilestone,
	createMilestone,
	getHorizonPlacement,
	getMilestone,
	listMilestones,
	listRoadmap,
	placeCandidate,
	placeHorizon,
	previewPlaceCandidate,
	saveRoadmapNamedView,
	setMilestoneStatus,
} from "./roadmap-horizon";
import {
	contributeToMilestoneCommandSchema,
	createMilestoneCommandSchema,
	getMilestoneQuerySchema,
	listMilestonesQuerySchema,
	listRoadmapQuerySchema,
	placeCandidateCommandSchema,
	placeHorizonCommandSchema,
	previewPlaceCandidateCommandSchema,
	roadmapCatalog,
	saveRoadmapNamedViewCommandSchema,
	setMilestoneStatusCommandSchema,
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
	contributeToMilestone: protectedWriteProcedure
		.input(
			contributeToMilestoneCommandSchema.omit({
				actorId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const milestone = await getMilestone(
				getPrismaClient(),
				input.milestoneId,
				access.workspaceId
			);
			if (!milestone) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireWork(access.workspaceId, input.workId);
			return await contributeToMilestone(getPrismaClient(), {
				...input,
				actorId: access.accountId,
			});
		}),
	createMilestone: protectedWriteProcedure
		.input(
			createMilestoneCommandSchema.omit({
				actorId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await createMilestone(getPrismaClient(), {
				...input,
				actorId: access.accountId,
			});
		}),
	getMilestone: protectedProcedure
		.input(getMilestoneQuerySchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const milestone = await getMilestone(
				getPrismaClient(),
				input.milestoneId,
				access.workspaceId
			);
			if (!milestone) {
				throw new ORPCError("NOT_FOUND");
			}
			return milestone;
		}),
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
	listMilestones: protectedProcedure
		.input(listMilestonesQuerySchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listMilestones(getPrismaClient(), input);
		}),
	place: protectedWriteProcedure
		.input(placeHorizonCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await placeHorizon(getPrismaClient(), input);
		}),
	placeCandidate: protectedWriteProcedure
		.input(placeCandidateCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await placeCandidate(getPrismaClient(), {
				...input,
				actorId: input.actorId ?? context.session.user.id,
			});
		}),
	placement: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await getHorizonPlacement(getPrismaClient(), input.workId);
		}),
	previewPlaceCandidate: protectedProcedure
		.input(previewPlaceCandidateCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await previewPlaceCandidate(getPrismaClient(), input);
		}),
	saveNamedView: protectedWriteProcedure
		.input(saveRoadmapNamedViewCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await saveRoadmapNamedView(getPrismaClient(), input);
		}),
	setMilestoneStatus: protectedWriteProcedure
		.input(
			setMilestoneStatusCommandSchema.omit({
				actorId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const milestone = await getMilestone(
				getPrismaClient(),
				input.milestoneId,
				access.workspaceId
			);
			if (!milestone) {
				throw new ORPCError("NOT_FOUND");
			}
			return await setMilestoneStatus(getPrismaClient(), {
				...input,
				actorId: access.accountId,
			});
		}),
};
