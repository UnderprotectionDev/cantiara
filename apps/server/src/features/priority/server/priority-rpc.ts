import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	archivePrioritizationSession,
	closePrioritizationSession,
	createPrioritizationSession,
	createPriorityCriterion,
	getPrioritizationSession,
	listPrioritizationSessions,
	listPriorityCriteria,
	listWorkPriorityValues,
	reopenPrioritizationSession,
	reorderPrioritizationSession,
	setPrioritizationSessionScope,
	setPriorityCriterionValue,
	trashPrioritizationSession,
	trashPriorityCriterion,
	updatePriorityCriterion,
} from "./priority";
import {
	createPrioritizationSessionPayloadSchema,
	createPriorityCriterionPayloadSchema,
	priorityCatalog,
	reorderPrioritizationSessionPayloadSchema,
	sessionIdPayloadSchema,
	setPrioritizationSessionScopePayloadSchema,
	setPriorityCriterionValuePayloadSchema,
	trashPriorityCriterionPayloadSchema,
	updatePriorityCriterionPayloadSchema,
} from "./priority-model";

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

async function requireSessionProject(workspaceId: string, sessionId: string) {
	const session = await getPrismaClient().prioritizationSession.findUnique({
		select: { projectId: true },
		where: { id: sessionId },
	});
	if (!session) {
		throw new ORPCError("NOT_FOUND");
	}
	return await requireProject(workspaceId, session.projectId);
}

export const priority = {
	archiveSession: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sessionIdPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await archivePrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => priorityCatalog()),
	closeSession: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sessionIdPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await closePrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createPriorityCriterionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createPriorityCriterion(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createSession: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createPrioritizationSessionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createPrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	getSession: protectedProcedure
		.input(z.object({ sessionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.sessionId);
			return await getPrioritizationSession(getPrismaClient(), input.sessionId);
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listPriorityCriteria(getPrismaClient(), input.projectId);
		}),
	listSessions: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listPrioritizationSessions(
				getPrismaClient(),
				input.projectId
			);
		}),
	reopenSession: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sessionIdPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await reopenPrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	reorderSession: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: reorderPrioritizationSessionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await reorderPrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setSessionScope: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setPrioritizationSessionScopePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await setPrioritizationSessionScope(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setValue: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setPriorityCriterionValuePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const definition =
				await getPrismaClient().projectPriorityCriterion.findUnique({
					select: { projectId: true },
					where: { id: input.payload.criterionId },
				});
			if (!definition) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, definition.projectId);
			return await setPriorityCriterionValue(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	trash: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: trashPriorityCriterionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const definition =
				await getPrismaClient().projectPriorityCriterion.findUnique({
					select: { projectId: true },
					where: { id: input.payload.criterionId },
				});
			if (!definition) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, definition.projectId);
			return await trashPriorityCriterion(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	trashSession: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: sessionIdPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSessionProject(access.workspaceId, input.payload.sessionId);
			return await trashPrioritizationSession(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	update: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updatePriorityCriterionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const definition =
				await getPrismaClient().projectPriorityCriterion.findUnique({
					select: { projectId: true },
					where: { id: input.payload.criterionId },
				});
			if (!definition) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, definition.projectId);
			return await updatePriorityCriterion(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	workValues: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listWorkPriorityValues(
				getPrismaClient(),
				input.projectId,
				input.workId
			);
		}),
};
