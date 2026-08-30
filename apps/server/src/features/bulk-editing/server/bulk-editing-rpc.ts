import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	cancelBulkEdit,
	previewBulkEdit,
	processBulkEdit,
	readBulkEdit,
	startBulkEdit,
	undoBulkEdit,
} from "./bulk-editing";

function continueWithoutWaiting(work: Promise<unknown>) {
	work.then(
		() => undefined,
		() => undefined
	);
}

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function requireSelectedWorks(workspaceId: string, workIds: string[]) {
	if (workIds.length === 0) {
		return;
	}
	const prisma = getPrismaClient();
	const rows = await prisma.work.findMany({
		select: { projectId: true },
		where: { id: { in: workIds } },
	});
	const projectIds = [...new Set(rows.map((row) => row.projectId))];
	const projects = await Promise.all(
		projectIds.map((projectId) => getProject(prisma, projectId))
	);
	if (
		projects.some((project) => !project || project.workspaceId !== workspaceId)
	) {
		throw new ORPCError("NOT_FOUND");
	}
}

export const bulkEditing = {
	apply: protectedWriteProcedure
		.input(
			z.object({
				changes: z.record(z.string(), z.unknown()),
				idempotencyKey: z.string().min(1),
				records: z.array(
					z.object({
						baseRevision: z.number().int().nonnegative(),
						idempotencyKey: z.string().min(1),
						workId: z.string().min(1),
					})
				),
				selectedWorkIds: z.array(z.string().min(1)),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSelectedWorks(access.workspaceId, input.selectedWorkIds);
			const prisma = getPrismaClient();
			const started = await startBulkEdit(prisma, {
				actorId: access.accountId,
				changes: input.changes,
				idempotencyKey: input.idempotencyKey,
				records: input.records,
				selectedWorkIds: input.selectedWorkIds,
			});
			if (started.status === "ok") {
				continueWithoutWaiting(processBulkEdit(prisma, started.job.jobId));
			}
			return started;
		}),
	cancel: protectedWriteProcedure
		.input(z.object({ jobId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await cancelBulkEdit(getPrismaClient(), input.jobId);
		}),
	get: protectedProcedure
		.input(z.object({ jobId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await readBulkEdit(getPrismaClient(), input.jobId);
		}),
	preview: protectedProcedure
		.input(
			z.object({
				changes: z.record(z.string(), z.unknown()),
				filterWorkIds: z.array(z.string().min(1)).optional(),
				selectedWorkIds: z.array(z.string()),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSelectedWorks(access.workspaceId, input.selectedWorkIds);
			return await previewBulkEdit(getPrismaClient(), input);
		}),
	undo: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				historyEntryId: z.string().min(1),
				idempotencyKey: z.string().min(1),
				jobId: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireSelectedWorks(access.workspaceId, [input.workId]);
			return await undoBulkEdit(getPrismaClient(), {
				actorId: access.accountId,
				...input,
			});
		}),
};
