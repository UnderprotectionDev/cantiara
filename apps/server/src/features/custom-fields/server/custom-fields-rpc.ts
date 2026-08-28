import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createCustomField,
	filterCustomFieldRecords,
	listCustomFieldRecordIds,
	listCustomFields,
	listSearchFilterFields,
	listSurfaceFields,
	setCustomFieldValue,
} from "./custom-fields";
import {
	createCustomFieldPayloadSchema,
	customFieldCatalog,
	customFieldFilterPayloadSchema,
	setCustomFieldValuePayloadSchema,
} from "./custom-fields-model";

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

export const customFields = {
	catalog: protectedProcedure.handler(() => customFieldCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createCustomFieldPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createCustomField(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	filter: protectedProcedure
		.input(customFieldFilterPayloadSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await filterCustomFieldRecords(getPrismaClient(), input);
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listCustomFields(getPrismaClient(), input.projectId);
		}),
	listRecords: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				recordType: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listCustomFieldRecordIds(
				getPrismaClient(),
				input.projectId,
				input.recordType
			);
		}),
	searchFields: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				recordType: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listSearchFilterFields(
				getPrismaClient(),
				input.projectId,
				input.recordType
			);
		}),
	setValue: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setCustomFieldValuePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const definition =
				await getPrismaClient().projectCustomFieldDefinition.findUnique({
					select: { projectId: true },
					where: { id: input.payload.definitionId },
				});
			if (!definition) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, definition.projectId);
			return await setCustomFieldValue(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	surface: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				recordId: z.string().min(1).optional(),
				recordType: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listSurfaceFields(
				getPrismaClient(),
				input.projectId,
				input.recordType,
				input.recordId
			);
		}),
};
