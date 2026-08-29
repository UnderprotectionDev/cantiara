import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	addActiveBlockingRelation,
	listWorkBlockers,
	markBlockerResolved,
	projectDependencies,
	reactivateBlockingRelation,
	removeBlockingRelation,
} from "./blockers";
import { BLOCKER_SOURCE_KINDS } from "./blockers-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function requireWork(workspaceId: string, workId: string) {
	const work = await getWork(getPrismaClient(), workId);
	if (!work) {
		throw new ORPCError("NOT_FOUND");
	}
	const project = await getProject(getPrismaClient(), work.projectId);
	if (!project || project.workspaceId !== workspaceId) {
		throw new ORPCError("NOT_FOUND");
	}
	return work;
}

export const blockers = {
	add: protectedWriteProcedure
		.input(
			z.object({
				blockedWorkId: z.string().min(1),
				idempotencyKey: z.string().min(1),
				source: z.object({
					id: z.string().min(1),
					kind: z.enum(BLOCKER_SOURCE_KINDS),
				}),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.blockedWorkId);
			return await addActiveBlockingRelation(getPrismaClient(), {
				actorId: access.accountId,
				blockedWorkId: input.blockedWorkId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				source: input.source,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	list: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await listWorkBlockers(getPrismaClient(), input.workId);
		}),
	projectDependencies: protectedProcedure
		.input(z.object({ workIds: z.array(z.string().min(1)) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await Promise.all(
				input.workIds.map((workId) => requireWork(access.workspaceId, workId))
			);
			return await projectDependencies(getPrismaClient(), input.workIds);
		}),
	reactivate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				relationId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await reactivateBlockingRelation(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				relationId: input.relationId,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	remove: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				relationId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await removeBlockingRelation(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				relationId: input.relationId,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	resolve: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				relationId: z.string().min(1),
				resolutionNote: z.string().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await markBlockerResolved(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				relationId: input.relationId,
				resolutionNote: input.resolutionNote,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
};
