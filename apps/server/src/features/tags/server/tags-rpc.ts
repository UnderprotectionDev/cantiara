import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	applyTag,
	createTag,
	listRecords,
	listTags,
	listWorkTags,
	markdownExportTags,
	removeTag,
	renameTag,
	suggestTags,
	undoTagRename,
} from "./tags";

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

async function requireWork(workspaceId: string, workId: string) {
	const work = await getWork(getPrismaClient(), workId);
	if (!work) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, work.projectId);
	return work;
}

const applyInput = z.object({
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string(),
	tagId: z.string().min(1),
	workId: z.string().min(1),
});

export const tags = {
	apply: protectedWriteProcedure
		.input(applyInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await applyTag(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				name: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createTag(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				name: input.name,
				origin: "human",
				workspaceId: access.workspaceId,
			});
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listTags(getPrismaClient(), access.workspaceId);
	}),
	listRecords: protectedProcedure
		.input(z.object({ tagId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await listRecords(getPrismaClient(), {
				tagId: input.tagId,
				workspaceId: access.workspaceId,
			});
		}),
	listWorkTags: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listWorkTags(getPrismaClient(), input.projectId);
		}),
	markdownExport: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await markdownExportTags(getPrismaClient(), access.workspaceId);
	}),
	remove: protectedWriteProcedure
		.input(applyInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await removeTag(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	rename: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				name: z.string(),
				tagId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await renameTag(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	suggest: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await suggestTags(getPrismaClient(), {
				projectId: input.projectId,
				workspaceId: access.workspaceId,
			});
		}),
	undoRename: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				historyEntryId: z.string().min(1),
				idempotencyKey: z.string(),
				tagId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await undoTagRename(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
};
