import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	createUsageLink,
	inspectRelations,
	unlinkUsageLink,
} from "./relations";
import { USAGE_KINDS } from "./relations-model";

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

export const relationsRouter = {
	createUsageLink: protectedWriteProcedure
		.input(
			z.object({
				hostRecordId: z.string().min(1),
				idempotencyKey: z.string().min(1),
				kind: z.enum(USAGE_KINDS),
				sourceRecordId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.hostRecordId);
			await requireWork(access.workspaceId, input.sourceRecordId);
			return await createUsageLink(getPrismaClient(), {
				actorId: access.accountId,
				hostRecordId: input.hostRecordId,
				idempotencyKey: input.idempotencyKey,
				kind: input.kind,
				origin: "human",
				sourceRecordId: input.sourceRecordId,
			});
		}),
	inspect: protectedProcedure
		.input(z.object({ recordId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.recordId);
			return await inspectRelations(getPrismaClient(), input.recordId);
		}),
	unlinkUsageLink: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				usageLinkId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const row = await getPrismaClient().usageLink.findUnique({
				where: { id: input.usageLinkId },
			});
			if (!row || row.workspaceId !== access.workspaceId) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireWork(access.workspaceId, row.hostRecordId);
			return await unlinkUsageLink(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				usageLinkId: input.usageLinkId,
			});
		}),
};
