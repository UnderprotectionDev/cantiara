import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
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

async function rejectForeignWork(workspaceId: string, recordId: string) {
	const work = await getPrismaClient().work.findUnique({
		where: { id: recordId },
	});
	if (!work) {
		return;
	}
	const project = await getProject(getPrismaClient(), work.projectId);
	if (!project || project.workspaceId !== workspaceId) {
		throw new ORPCError("NOT_FOUND");
	}
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
			await rejectForeignWork(access.workspaceId, input.hostRecordId);
			await rejectForeignWork(access.workspaceId, input.sourceRecordId);
			return await createUsageLink(getPrismaClient(), {
				actorId: access.accountId,
				hostRecordId: input.hostRecordId,
				idempotencyKey: input.idempotencyKey,
				kind: input.kind,
				origin: "human",
				sourceRecordId: input.sourceRecordId,
				workspaceId: access.workspaceId,
			});
		}),
	inspect: protectedProcedure
		.input(z.object({ recordId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await rejectForeignWork(access.workspaceId, input.recordId);
			return await inspectRelations(
				getPrismaClient(),
				input.recordId,
				access.workspaceId
			);
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
			await rejectForeignWork(access.workspaceId, row.hostRecordId);
			return await unlinkUsageLink(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				usageLinkId: input.usageLinkId,
			});
		}),
};
