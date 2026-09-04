import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createValidationRecord,
	getValidationRecord,
	listValidationRecords,
	relateValidationContext,
} from "./validation-records";
import {
	createValidationRecordPayloadSchema,
	relateValidationContextPayloadSchema,
	validationRecordsCatalog,
} from "./validation-records-model";

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

export const validationRecords = {
	catalog: protectedProcedure.handler(() => validationRecordsCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createValidationRecordPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createValidationRecord(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ validationRecordId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getValidationRecord(
				getPrismaClient(),
				input.validationRecordId,
				access.workspaceId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return record;
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listValidationRecords(
				getPrismaClient(),
				input.projectId,
				access.workspaceId
			);
		}),
	relateContext: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: relateValidationContextPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const record = await getValidationRecord(
				getPrismaClient(),
				input.payload.validationRecordId,
				access.workspaceId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, record.projectId);
			return await relateValidationContext(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				viewerWorkspaceId: access.workspaceId,
			});
		}),
};
