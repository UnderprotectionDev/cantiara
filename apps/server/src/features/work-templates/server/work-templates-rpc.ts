import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	createWorkTemplate,
	duplicateWork,
	instantiateWorkFromTemplate,
	listWorkTemplates,
	previewDuplicateWork,
	previewWorkTemplateDates,
	trashWorkTemplate,
	updateWorkTemplate,
} from "./work-templates";
import {
	createWorkTemplatePayloadSchema,
	duplicateWorkPayloadSchema,
	instantiateWorkFromTemplatePayloadSchema,
	previewDuplicateWorkInputSchema,
	previewRelativeDatesInputSchema,
	trashWorkTemplatePayloadSchema,
	updateWorkTemplatePayloadSchema,
	workTemplatesCatalog,
} from "./work-templates-model";

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

export const workTemplates = {
	catalog: protectedProcedure.handler(() => workTemplatesCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createWorkTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createWorkTemplate(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	duplicate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: duplicateWorkPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const row = await getPrismaClient().work.findUnique({
				select: { projectId: true },
				where: { id: input.payload.workId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
			return await duplicateWork(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	instantiate: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: instantiateWorkFromTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const row = await getPrismaClient().workTemplate.findUnique({
				select: { projectId: true },
				where: { id: input.payload.templateId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
			return await instantiateWorkFromTemplate(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
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
			return await listWorkTemplates(getPrismaClient(), input.projectId);
		}),
	previewDates: protectedProcedure
		.input(previewRelativeDatesInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.templateId) {
				const row = await getPrismaClient().workTemplate.findUnique({
					select: { projectId: true },
					where: { id: input.templateId },
				});
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				await requireProject(access.workspaceId, row.projectId);
			}
			return await previewWorkTemplateDates(getPrismaClient(), input);
		}),
	previewDuplicate: protectedProcedure
		.input(previewDuplicateWorkInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const row = await getPrismaClient().work.findUnique({
				select: { projectId: true },
				where: { id: input.workId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
			return await previewDuplicateWork(getPrismaClient(), input.workId);
		}),
	trash: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: trashWorkTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const row = await getPrismaClient().workTemplate.findUnique({
				select: { projectId: true },
				where: { id: input.payload.templateId },
			});
			if (!row) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireProject(access.workspaceId, row.projectId);
			return await trashWorkTemplate(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	update: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updateWorkTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await updateWorkTemplate(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
};
