import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	archiveWork,
	changeWorkStatus,
	changeWorkType,
	closeWork,
	convertCaptureToWork,
	createWork,
	finalizeDraft,
	getWork,
	getWorkByKey,
	listWork,
	listWorkLifecycleHistory,
	mergeWork,
	previewClose,
	previewRecreate,
	previewWorkMerge,
	previewWorkTypeChange,
	recreateWork,
	reopenWork,
	unarchiveWork,
	undoWorkMerge,
	updateWorkTitle,
} from "./work-lifecycle";
import {
	CLOSURE_RESULTS,
	createWorkPayloadSchema,
	NON_TERMINAL_WORK_STATUSES,
	previewCloseInputSchema,
	previewRecreateInputSchema,
	previewWorkMergeInputSchema,
	recreateWorkPayloadSchema,
	WORK_LIFECYCLE_COPY,
	WORK_STATUSES,
	WORK_TYPES,
	workMergeFieldChoicesSchema,
} from "./work-lifecycle-model";

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

export const workLifecycle = {
	archive: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await archiveWork(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				workId: input.workId,
			});
		}),
	catalog: protectedProcedure.handler(() => ({
		closureResults: CLOSURE_RESULTS,
		copy: WORK_LIFECYCLE_COPY,
		nonTerminalStatuses: NON_TERMINAL_WORK_STATUSES,
		statuses: WORK_STATUSES,
		types: WORK_TYPES,
	})),
	changeStatus: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				status: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await changeWorkStatus(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				status: input.status,
				workId: input.workId,
			});
		}),
	changeType: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				previewAcknowledged: z.boolean().optional(),
				type: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await changeWorkType(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				previewAcknowledged: input.previewAcknowledged,
				type: input.type,
				workId: input.workId,
			});
		}),
	close: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				reason: z.string().optional(),
				result: z.string().optional(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await closeWork(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				reason: input.reason,
				result: input.result,
				workId: input.workId,
			});
		}),
	convertCapture: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await convertCaptureToWork(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createWork(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	finalizeDraft: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await finalizeDraft(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	get: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireWork(access.workspaceId, input.workId);
		}),
	list: protectedProcedure
		.input(
			z.object({
				archived: z.boolean().optional(),
				projectId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listWork(getPrismaClient(), input.projectId, {
				archived: input.archived,
			});
		}),
	listHistory: protectedProcedure
		.input(z.object({ workId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await listWorkLifecycleHistory(getPrismaClient(), input.workId);
		}),
	merge: protectedWriteProcedure
		.input(
			z.object({
				duplicateBaseRevision: z.number().int().nonnegative(),
				duplicateId: z.string().min(1),
				fieldChoices: workMergeFieldChoicesSchema.optional(),
				idempotencyKey: z.string(),
				previewAcknowledged: z.boolean().optional(),
				survivorBaseRevision: z.number().int().nonnegative(),
				survivorId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.survivorId);
			await requireWork(access.workspaceId, input.duplicateId);
			return await mergeWork(getPrismaClient(), {
				actorId: access.accountId,
				duplicateBaseRevision: input.duplicateBaseRevision,
				duplicateId: input.duplicateId,
				fieldChoices: input.fieldChoices,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				previewAcknowledged: input.previewAcknowledged,
				survivorBaseRevision: input.survivorBaseRevision,
				survivorId: input.survivorId,
			});
		}),
	previewClose: protectedProcedure
		.input(previewCloseInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			const preview = await previewClose(getPrismaClient(), input);
			if ("reason" in preview) {
				throw new ORPCError("NOT_FOUND");
			}
			return preview;
		}),
	previewMerge: protectedProcedure
		.input(previewWorkMergeInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.survivorId);
			await requireWork(access.workspaceId, input.duplicateId);
			const preview = await previewWorkMerge(getPrismaClient(), input);
			if ("reason" in preview) {
				throw new ORPCError("BAD_REQUEST");
			}
			return preview;
		}),
	previewRecreate: protectedProcedure
		.input(previewRecreateInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			await requireProject(access.workspaceId, input.targetProjectId);
			const preview = await previewRecreate(getPrismaClient(), input);
			if ("reason" in preview) {
				throw new ORPCError("NOT_FOUND");
			}
			return preview;
		}),
	previewTypeChange: protectedProcedure
		.input(
			z.object({
				type: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			const preview = await previewWorkTypeChange(
				getPrismaClient(),
				input.workId,
				input.type
			);
			if ("reason" in preview) {
				throw new ORPCError("BAD_REQUEST");
			}
			return preview;
		}),
	recreate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: recreateWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.payload.workId);
			await requireProject(access.workspaceId, input.payload.targetProjectId);
			return await recreateWork(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	reopen: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				reopenConfirmed: z.boolean().optional(),
				status: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await reopenWork(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				reopenConfirmed: input.reopenConfirmed,
				status: input.status,
				workId: input.workId,
			});
		}),
	resolve: protectedProcedure
		.input(
			z.object({
				key: z.string().min(1),
				projectId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			const work = await getWorkByKey(
				getPrismaClient(),
				input.projectId,
				input.key
			);
			if (!work) {
				throw new ORPCError("NOT_FOUND");
			}
			return work;
		}),
	unarchive: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await unarchiveWork(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				workId: input.workId,
			});
		}),
	undoMerge: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				mergeEventId: z.string().min(1),
				survivorId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.survivorId);
			return await undoWorkMerge(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				mergeEventId: input.mergeEventId,
				origin: "human",
				survivorId: input.survivorId,
			});
		}),
	updateTitle: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				title: z.string(),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireWork(access.workspaceId, input.workId);
			return await updateWorkTitle(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				title: input.title,
				workId: input.workId,
			});
		}),
};
