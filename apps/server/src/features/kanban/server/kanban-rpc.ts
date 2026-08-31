import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	closeKanbanCardForProject,
	loadKanbanBoard,
	moveKanbanCardForProject,
	reopenKanbanCardForProject,
	saveKanbanLimits,
} from "./kanban";
import { KANBAN_COPY } from "./kanban-model";

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

export const kanban = {
	board: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await loadKanbanBoard(getPrismaClient(), input.projectId);
		}),
	catalog: protectedProcedure.handler(() => ({
		copy: KANBAN_COPY,
	})),
	closeCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string().min(1),
				reason: z.string().optional(),
				result: z.string().optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await closeKanbanCardForProject(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				reason: input.reason,
				result: input.result,
				workId: input.workId,
			});
		}),
	moveCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string().min(1),
				targetStatus: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await moveKanbanCardForProject(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				targetStatus: input.targetStatus,
				workId: input.workId,
			});
		}),
	reopenCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				confirmed: z.boolean(),
				idempotencyKey: z.string().min(1),
				targetStatus: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await reopenKanbanCardForProject(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				confirmed: input.confirmed,
				idempotencyKey: input.idempotencyKey,
				targetStatus: input.targetStatus,
				workId: input.workId,
			});
		}),
	saveLimits: protectedWriteProcedure
		.input(
			z.object({
				focusThreshold: z.number().int().nullable(),
				projectId: z.string().min(1),
				softWipLimits: z.array(
					z.object({
						limit: z.number().int().nullable(),
						status: z.string().min(1),
					})
				),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await saveKanbanLimits(getPrismaClient(), {
				focusThreshold: input.focusThreshold,
				projectId: input.projectId,
				softWipLimits: input.softWipLimits,
			});
		}),
};
