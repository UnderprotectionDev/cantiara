import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	confirmReconcile,
	listHandoffsForWork,
	previewReconcile,
	recordReturn,
	rejectReconcile,
	startHandoff,
} from "./external-handoffs";
import {
	confirmReconcilePayloadSchema,
	recordReturnPayloadSchema,
	rejectReconcilePayloadSchema,
	startHandoffPayloadSchema,
} from "./external-handoffs-model";

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

async function requireHandoffWork(workspaceId: string, handoffId: string) {
	const row = await getPrismaClient().externalExecutionHandoff.findUnique({
		where: { id: handoffId },
	});
	if (!row) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireWork(workspaceId, row.workId);
	return row;
}

export const externalHandoffs = {
	confirmReconcile: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: confirmReconcilePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireHandoffWork(access.workspaceId, input.payload.handoffId);
			return await confirmReconcile(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	list: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await listHandoffsForWork(getPrismaClient(), input.workId);
		}),
	previewReconcile: protectedProcedure
		.input(z.object({ handoffId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireHandoffWork(access.workspaceId, input.handoffId);
			return await previewReconcile(getPrismaClient(), input.handoffId);
		}),
	recordReturn: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: recordReturnPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireHandoffWork(access.workspaceId, input.payload.handoffId);
			return await recordReturn(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	rejectReconcile: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: rejectReconcilePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireHandoffWork(access.workspaceId, input.payload.handoffId);
			return await rejectReconcile(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	start: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: startHandoffPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.payload.workId);
			return await startHandoff(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
