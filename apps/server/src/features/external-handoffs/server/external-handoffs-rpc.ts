import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	cancelHandoff,
	listHandoffsForWork,
	startHandoff,
} from "./external-handoffs";
import {
	cancelHandoffPayloadSchema,
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

export const externalHandoffs = {
	cancel: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: cancelHandoffPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const prisma = getPrismaClient();
			const existing = await prisma.externalExecutionHandoff.findUnique({
				where: { id: input.payload.handoffId },
			});
			if (!existing) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireWork(access.workspaceId, existing.workId);
			return await cancelHandoff(prisma, {
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
