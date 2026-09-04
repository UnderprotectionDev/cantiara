import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getSource } from "../../sources-and-freshness/server/sources";
import {
	createFeedback,
	createFeedbackFromSource,
	getFeedback,
	listFeedback,
	setFeedbackStatus,
} from "./feedback";
import {
	createFeedbackFromSourcePayloadSchema,
	createFeedbackPayloadSchema,
	FEEDBACK_STATUSES,
	feedbackCatalog,
	setFeedbackStatusPayloadSchema,
} from "./feedback-model";

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

export const feedback = {
	catalog: protectedProcedure.handler(() => feedbackCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createFeedbackPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createFeedback(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createFromSource: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createFeedbackFromSourcePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const source = await getSource(getPrismaClient(), input.payload.sourceId);
			if (!source) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, source.projectId);
			return await createFeedbackFromSource(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ feedbackId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(getPrismaClient(), input.feedbackId);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return record;
		}),
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				status: z.enum(FEEDBACK_STATUSES).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listFeedback(getPrismaClient(), input.projectId, {
				status: input.status,
			});
		}),
	setStatus: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setFeedbackStatusPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getFeedback(
				getPrismaClient(),
				input.payload.feedbackId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await setFeedbackStatus(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
