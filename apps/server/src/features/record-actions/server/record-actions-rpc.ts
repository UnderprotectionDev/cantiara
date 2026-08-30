import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	defineRecordAction,
	listRecordActions,
	resolveRecordAction,
	trashRecordAction,
} from "./record-actions";
import {
	applyRecordActionPayloadSchema,
	createRecordActionPayloadSchema,
	recordActionsCatalog,
	trashRecordActionPayloadSchema,
	undoRecordActionPayloadSchema,
} from "./record-actions-model";
import {
	applyRecordAction,
	previewRecordAction,
	recordActionIdForRun,
	undoRecordAction,
} from "./record-actions-run";

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

export const recordActions = {
	apply: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: applyRecordActionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireRecordActionProject(
				access.workspaceId,
				input.payload.recordActionId
			);
			return await applyRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	catalog: protectedProcedure.handler(() => recordActionsCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createRecordActionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await defineRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listRecordActions(getPrismaClient(), input.projectId);
		}),
	preview: protectedProcedure
		.input(
			z.object({
				inputValues: z
					.array(z.object({ key: z.string().min(1), value: z.string() }))
					.optional(),
				recordActionId: z.string().min(1),
				targetRecordId: z.string().min(1),
				targetRecordIds: z.array(z.string().min(1)).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireRecordActionProject(
				access.workspaceId,
				input.recordActionId
			);
			return await previewRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				inputValues: input.inputValues,
				recordActionId: input.recordActionId,
				targetRecordId: input.targetRecordId,
				targetRecordIds: input.targetRecordIds,
			});
		}),
	resolve: protectedProcedure
		.input(
			z.object({
				recordActionId: z.string().min(1),
				targetRecordId: z.string().min(1),
				targetRecordIds: z.array(z.string().min(1)).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireRecordActionProject(
				access.workspaceId,
				input.recordActionId
			);
			return await resolveRecordAction(getPrismaClient(), input);
		}),
	trash: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: trashRecordActionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireRecordActionProject(
				access.workspaceId,
				input.payload.recordActionId
			);
			return await trashRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	undo: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: undoRecordActionPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const recordActionId = await recordActionIdForRun(
				getPrismaClient(),
				input.payload.runId
			);
			if (!recordActionId) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireRecordActionProject(access.workspaceId, recordActionId);
			return await undoRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};

async function requireRecordActionProject(
	workspaceId: string,
	recordActionId: string
) {
	const row = await getPrismaClient().recordAction.findUnique({
		select: { projectId: true },
		where: { id: recordActionId },
	});
	if (!row) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, row.projectId);
}
