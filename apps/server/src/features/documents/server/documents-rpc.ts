import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	convertDocumentToTemplate,
	createDocument,
	createDocumentTemplate,
	getDocument,
	getDocumentTemplate,
	instantiateDocumentFromTemplate,
	listDocuments,
	listDocumentTemplates,
	previewConvertDocumentToTemplate,
	updateDocument,
	updateDocumentTemplate,
} from "./documents";
import {
	convertDocumentToTemplatePayloadSchema,
	createDocumentPayloadSchema,
	createDocumentTemplatePayloadSchema,
	documentScopeSchema,
	documentsCatalog,
	instantiateDocumentFromTemplatePayloadSchema,
	presentDocumentBody,
	updateDocumentPayloadSchema,
	updateDocumentTemplatePayloadSchema,
} from "./documents-model";

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

async function requireScope(
	workspaceId: string,
	scope: z.infer<typeof documentScopeSchema>
) {
	if (scope.kind === "project") {
		await requireProject(workspaceId, scope.projectId);
	}
}

export const documents = {
	catalog: protectedProcedure.handler(() => documentsCatalog()),
	convertToTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: convertDocumentToTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const document = await getDocument(
				getPrismaClient(),
				input.payload.documentId,
				access.workspaceId
			);
			if (!document) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireScope(access.workspaceId, document.scope);
			return await convertDocumentToTemplate(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createDocumentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScope(access.workspaceId, input.payload.scope);
			return await createDocument(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	createTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createDocumentTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScope(access.workspaceId, input.payload.scope);
			return await createDocumentTemplate(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ documentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const document = await getDocument(
				getPrismaClient(),
				input.documentId,
				access.workspaceId
			);
			if (!document) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireScope(access.workspaceId, document.scope);
			return document;
		}),
	instantiateFromTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: instantiateDocumentFromTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.payload.scope) {
				await requireScope(access.workspaceId, input.payload.scope);
			}
			if (input.payload.templateId) {
				const template = await getDocumentTemplate(
					getPrismaClient(),
					input.payload.templateId,
					access.workspaceId
				);
				if (!template) {
					throw new ORPCError("NOT_FOUND");
				}
				await requireScope(access.workspaceId, template.scope);
			}
			return await instantiateDocumentFromTemplate(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	list: protectedProcedure
		.input(z.object({ scope: documentScopeSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScope(access.workspaceId, input.scope);
			return await listDocuments(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	listTemplates: protectedProcedure
		.input(z.object({ scope: documentScopeSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScope(access.workspaceId, input.scope);
			return await listDocumentTemplates(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	present: protectedProcedure
		.input(z.object({ body: z.string() }))
		.handler(({ input }) => presentDocumentBody(input.body)),
	previewConvertToTemplate: protectedProcedure
		.input(z.object({ documentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertDocumentToTemplate(
				getPrismaClient(),
				input.documentId,
				access.workspaceId
			);
		}),
	update: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updateDocumentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await updateDocument(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	updateTemplate: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: updateDocumentTemplatePayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const template = await getDocumentTemplate(
				getPrismaClient(),
				input.payload.templateId,
				access.workspaceId
			);
			if (!template) {
				throw new ORPCError("NOT_FOUND");
			}
			await requireScope(access.workspaceId, template.scope);
			return await updateDocumentTemplate(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
};
