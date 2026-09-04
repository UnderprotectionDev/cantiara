import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createAssumption,
	createOpenQuestion,
	getAssumption,
	getOpenQuestion,
	listAssumptions,
	listOpenQuestions,
	setAssumptionLife,
	setOpenQuestionLife,
} from "./uncertainty-records";
import {
	ASSUMPTION_LIVES,
	createAssumptionPayloadSchema,
	createOpenQuestionPayloadSchema,
	OPEN_QUESTION_LIVES,
	setAssumptionLifePayloadSchema,
	setOpenQuestionLifePayloadSchema,
	UNCERTAINTY_COPY,
} from "./uncertainty-records-model";

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

export const uncertaintyRecords = {
	catalog: protectedProcedure.handler(() => UNCERTAINTY_COPY),
	createAssumption: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createAssumptionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createAssumption(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createOpenQuestion: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createOpenQuestionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createOpenQuestion(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	getAssumption: protectedProcedure
		.input(z.object({ assumptionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const assumption = await getAssumption(
				getPrismaClient(),
				input.assumptionId
			);
			if (!assumption) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, assumption.projectId);
			return assumption;
		}),
	getOpenQuestion: protectedProcedure
		.input(z.object({ openQuestionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const openQuestion = await getOpenQuestion(
				getPrismaClient(),
				input.openQuestionId
			);
			if (!openQuestion) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, openQuestion.projectId);
			return openQuestion;
		}),
	listAssumptions: protectedProcedure
		.input(
			z.object({
				life: z.enum(ASSUMPTION_LIVES).optional(),
				projectId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listAssumptions(getPrismaClient(), input.projectId, {
				life: input.life,
			});
		}),
	listOpenQuestions: protectedProcedure
		.input(
			z.object({
				life: z.enum(OPEN_QUESTION_LIVES).optional(),
				projectId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listOpenQuestions(getPrismaClient(), input.projectId, {
				life: input.life,
			});
		}),
	setAssumptionLife: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setAssumptionLifePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const assumption = await getAssumption(
				getPrismaClient(),
				input.payload.assumptionId
			);
			if (!assumption) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, assumption.projectId);
			return await setAssumptionLife(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	setOpenQuestionLife: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setOpenQuestionLifePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const openQuestion = await getOpenQuestion(
				getPrismaClient(),
				input.payload.openQuestionId
			);
			if (!openQuestion) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, openQuestion.projectId);
			return await setOpenQuestionLife(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
