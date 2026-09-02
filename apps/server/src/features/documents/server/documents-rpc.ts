import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	archiveDocument,
	createDocument,
	createDocumentFolder,
	getDocument,
	listDocumentFolders,
	listDocuments,
	placeDocument,
	previewDocumentArchive,
	previewDocumentPlacement,
	unarchiveDocument,
	updateDocument,
} from "./documents";
import {
	createDocumentFolderPayloadSchema,
	createDocumentPayloadSchema,
	documentScopeSchema,
	documentsCatalog,
	placeDocumentPayloadSchema,
	presentDocumentBody,
	updateDocumentPayloadSchema,
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

const documentWriteInput = z.object({
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string(),
	payload: z.object({ documentId: z.string().min(1) }),
});

export const documents = {
	archive: protectedWriteProcedure
		.input(documentWriteInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await archiveDocument(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
				...input,
			});
		}),
	catalog: protectedProcedure.handler(() => documentsCatalog()),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createDocumentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.payload.scope.kind === "project") {
				await requireProject(access.workspaceId, input.payload.scope.projectId);
			}
			return await createDocument(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	createFolder: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createDocumentFolderPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.payload.scope.kind === "project") {
				await requireProject(access.workspaceId, input.payload.scope.projectId);
			}
			return await createDocumentFolder(getPrismaClient(), {
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
			if (document.scope.kind === "project") {
				await requireProject(access.workspaceId, document.scope.projectId);
			}
			return document;
		}),
	list: protectedProcedure
		.input(
			z.object({
				archived: z.boolean().optional(),
				scope: documentScopeSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.scope.kind === "project") {
				await requireProject(access.workspaceId, input.scope.projectId);
			}
			return await listDocuments(getPrismaClient(), {
				archived: input.archived,
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	listFolders: protectedProcedure
		.input(z.object({ scope: documentScopeSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.scope.kind === "project") {
				await requireProject(access.workspaceId, input.scope.projectId);
			}
			return await listDocumentFolders(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	place: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: placeDocumentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await placeDocument(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
				...input,
			});
		}),
	present: protectedProcedure
		.input(z.object({ body: z.string() }))
		.handler(({ input }) => presentDocumentBody(input.body)),
	previewArchive: protectedProcedure
		.input(z.object({ documentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewDocumentArchive(getPrismaClient(), {
				documentId: input.documentId,
				workspaceId: access.workspaceId,
			});
		}),
	previewPlacement: protectedProcedure
		.input(
			z.object({
				documentId: z.string().min(1),
				folderId: z.string().nullable(),
				parentId: z.string().nullable(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewDocumentPlacement(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	unarchive: protectedWriteProcedure
		.input(documentWriteInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await unarchiveDocument(getPrismaClient(), {
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
				...input,
			});
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
};
