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
	previewClosedWorld,
	previewRemoveSupersession,
	previewSupersession,
	removeSupersession,
	searchDecisions,
	setDecisionLife,
	supersedeDecisions,
	withdrawDecision,
} from "./decisions";
import {
	createDecisionPayloadSchema,
	DECISION_LIVES,
	DECISIONS_COPY,
	previewRemoveSupersessionInputSchema,
	previewSupersessionInputSchema,
	removeSupersessionPayloadSchema,
	setDecisionLifePayloadSchema,
	supersedePayloadSchema,
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
		.input(
			z.object({
				life: z.enum(DECISION_LIVES).optional(),
				projectId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listDecisions(getPrismaClient(), input.projectId, {
				life: input.life,
			});
		}),
	previewClosedWorld: protectedProcedure
		.input(z.object({ decisionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const decision = await getDecision(getPrismaClient(), input.decisionId);
			if (!decision) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, decision.projectId);
			return await previewClosedWorld(getPrismaClient(), input.decisionId);
		}),
	previewRemoveSupersession: protectedProcedure
		.input(previewRemoveSupersessionInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const successor = await getDecision(
				getPrismaClient(),
				input.payload.successorId
			);
			if (!successor) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, successor.projectId);
			return await previewRemoveSupersession(getPrismaClient(), input);
		}),
	previewSupersession: protectedProcedure
		.input(previewSupersessionInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const successor = await getDecision(
				getPrismaClient(),
				input.payload.successorId
			);
			if (!successor) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, successor.projectId);
			return await previewSupersession(getPrismaClient(), input);
		}),
	removeSupersession: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: removeSupersessionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const successor = await getDecision(
				getPrismaClient(),
				input.payload.successorId
			);
			if (!successor) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, successor.projectId);
			return await removeSupersession(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	search: protectedProcedure
		.input(
			z.object({
				life: z.enum(DECISION_LIVES).optional(),
				projectId: z.string().min(1),
				text: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await searchDecisions(getPrismaClient(), {
				life: input.life,
				projectId: input.projectId,
				text: input.text,
			});
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
	supersede: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: supersedePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const successor = await getDecision(
				getPrismaClient(),
				input.payload.successorId
			);
			if (!successor) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, successor.projectId);
			return await supersedeDecisions(getPrismaClient(), {
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
