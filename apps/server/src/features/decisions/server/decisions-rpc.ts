import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createDecision,
	getDecision,
	listDecisions,
	setDecisionLife,
	withdrawDecision,
} from "./decisions";
import {
	createDecisionPayloadSchema,
	DECISIONS_COPY,
	setDecisionLifePayloadSchema,
	withdrawDecisionPayloadSchema,
} from "./decisions-model";

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

export const decisions = {
	catalog: protectedProcedure.handler(() => DECISIONS_COPY),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createDecisionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createDecision(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ decisionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const decision = await getDecision(getPrismaClient(), input.decisionId);
			if (!decision) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, decision.projectId);
			return decision;
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listDecisions(getPrismaClient(), input.projectId);
		}),
	setLife: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setDecisionLifePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const decision = await getDecision(
				getPrismaClient(),
				input.payload.decisionId
			);
			if (!decision) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, decision.projectId);
			return await setDecisionLife(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	withdraw: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: withdrawDecisionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const decision = await getDecision(
				getPrismaClient(),
				input.payload.decisionId
			);
			if (!decision) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, decision.projectId);
			return await withdrawDecision(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
