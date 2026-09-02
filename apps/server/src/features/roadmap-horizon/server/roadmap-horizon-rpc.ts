import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	applyNotNow,
	getNotNowTrail,
	listNotNowMarks,
	previewNotNow,
	previewReconsiderNotNow,
	reconsiderNotNow,
} from "./not-now-trail";
import {
	getHorizonPlacement,
	listRoadmap,
	placeCandidate,
	placeHorizon,
	previewPlaceCandidate,
	saveRoadmapNamedView,
} from "./roadmap-horizon";
import {
	applyNotNowCommandSchema,
	getNotNowQuerySchema,
	listNotNowMarksQuerySchema,
	listRoadmapQuerySchema,
	NOT_NOW_REVIEW_LATER_EFFECTS,
	notNowDraftSchema,
	placeCandidateCommandSchema,
	placeHorizonCommandSchema,
	previewPlaceCandidateCommandSchema,
	reconsiderNotNowCommandSchema,
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
	applyNotNow: protectedWriteProcedure
		.input(applyNotNowCommandSchema.omit({ actorId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await applyNotNow(getPrismaClient(), {
				...input,
				actorId: context.session.user.id,
			});
		}),
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
	notNow: protectedProcedure
		.input(getNotNowQuerySchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await getNotNowTrail(getPrismaClient(), input.workId);
		}),
	notNowMarks: protectedProcedure
		.input(listNotNowMarksQuerySchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listNotNowMarks(getPrismaClient(), input.projectId);
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
	previewNotNow: protectedProcedure
		.input(notNowDraftSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			const preview = await previewNotNow(getPrismaClient(), input);
			if ("status" in preview) {
				throw new ORPCError("NOT_FOUND");
			}
			return preview;
		}),
	previewPlaceCandidate: protectedProcedure
		.input(previewPlaceCandidateCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await previewPlaceCandidate(getPrismaClient(), input);
		}),
	previewReconsiderNotNow: protectedProcedure
		.input(
			z.object({
				reviewLaterEffect: z.enum(NOT_NOW_REVIEW_LATER_EFFECTS).optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			const preview = await previewReconsiderNotNow(getPrismaClient(), input);
			if ("status" in preview) {
				throw new ORPCError("NOT_FOUND");
			}
			return preview;
		}),
	reconsiderNotNow: protectedWriteProcedure
		.input(reconsiderNotNowCommandSchema.omit({ actorId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await reconsiderNotNow(getPrismaClient(), {
				...input,
				actorId: context.session.user.id,
			});
		}),
	saveNamedView: protectedWriteProcedure
		.input(saveRoadmapNamedViewCommandSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await saveRoadmapNamedView(getPrismaClient(), input);
		}),
};
