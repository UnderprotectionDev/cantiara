import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createPriorityCriterion,
	listPriorityCriteria,
	listWorkPriorityValues,
	setPriorityCriterionValue,
	trashPriorityCriterion,
	updatePriorityCriterion,
} from "./priority";
import {
	createPriorityCriterionPayloadSchema,
	priorityCatalog,
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

export const priority = {
	catalog: protectedProcedure.handler(() => priorityCatalog()),
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
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listPriorityCriteria(getPrismaClient(), input.projectId);
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
