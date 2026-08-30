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
	createRecordActionPayloadSchema,
	recordActionsCatalog,
	trashRecordActionPayloadSchema,
} from "./record-actions-model";

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
			const row = await getPrismaClient().recordAction.findUnique({
				select: { projectId: true },
				where: { id: input.recordActionId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
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
			const row = await getPrismaClient().recordAction.findUnique({
				select: { projectId: true },
				where: { id: input.payload.recordActionId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
			return await trashRecordAction(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
