import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import { getWork } from "../../work-lifecycle/server/work-lifecycle";
import {
	addChecklistItem,
	convertChecklistItem,
	getWorkChecklist,
	previewConvertChecklistItem,
	removeChecklistItem,
	reorderChecklistItems,
	setChecklistItemCompleted,
	updateChecklistItem,
} from "./work-checklists";

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

const writeBase = {
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string(),
	workId: z.string().min(1),
};

export const workChecklists = {
	add: protectedWriteProcedure
		.input(z.object({ ...writeBase, title: z.string() }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await addChecklistItem(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	convert: protectedWriteProcedure
		.input(
			z.object({
				...writeBase,
				itemId: z.string().min(1),
				previewAcknowledged: z.boolean(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await convertChecklistItem(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	get: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await getWorkChecklist(getPrismaClient(), input.workId);
		}),
	previewConvert: protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await previewConvertChecklistItem(getPrismaClient(), input);
		}),
	remove: protectedWriteProcedure
		.input(z.object({ ...writeBase, itemId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await removeChecklistItem(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	reorder: protectedWriteProcedure
		.input(
			z.object({
				...writeBase,
				orderedItemIds: z.array(z.string().min(1)),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await reorderChecklistItems(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	setCompleted: protectedWriteProcedure
		.input(
			z.object({
				...writeBase,
				completed: z.boolean(),
				itemId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await setChecklistItemCompleted(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
	update: protectedWriteProcedure
		.input(
			z.object({
				...writeBase,
				itemId: z.string().min(1),
				title: z.string(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await updateChecklistItem(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				...input,
			});
		}),
};
