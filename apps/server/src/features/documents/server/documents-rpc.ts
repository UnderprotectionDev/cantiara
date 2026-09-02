import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	compareDocumentVersions,
	convertDocumentToTemplate,
	createDocument,
	createDocumentTemplate,
	getDocument,
	getDocumentTemplate,
	instantiateDocumentFromTemplate,
	listDocuments,
	listDocumentTemplates,
	listDocumentVersions,
	materializeStarterSkeletonDocuments,
	previewConvertDocumentToTemplate,
	restoreDocumentVersion,
	updateDocument,
	updateDocumentTemplate,
} from "./documents";
import {
	convertList,
	convertListCommandSchema,
	convertMermaidCommandSchema,
	convertMermaidToTechnicalDiagram,
	convertSelection,
	convertSelectionCommandSchema,
	createMemoryTechnicalDiagramImport,
	pinVersionPinnedEvidence,
	pinVersionPinnedEvidenceCommandSchema,
	previewConvertList,
	previewConvertListInputSchema,
	previewConvertMermaid,
	previewConvertMermaidInputSchema,
	previewConvertSelection,
	previewConvertSelectionInputSchema,
} from "./documents-convert";
import { presentLiveDocumentBody } from "./documents-live";
import {
	convertDocumentToTemplatePayloadSchema,
	createDocumentPayloadSchema,
	createDocumentTemplatePayloadSchema,
	documentScopeSchema,
	documentsCatalog,
	instantiateDocumentFromTemplatePayloadSchema,
	materializeStarterSkeletonDocumentsPayloadSchema,
	presentDocumentBody,
	restoreDocumentPayloadSchema,
	updateDocumentPayloadSchema,
	updateDocumentTemplatePayloadSchema,
} from "./documents-model";

const diagramStore = createMemoryTechnicalDiagramImport();

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
	compare: protectedProcedure
		.input(
			z.object({
				documentId: z.string().min(1),
				leftRevision: z.number().int().positive(),
				rightRevision: z.number().int().positive(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const compared = await compareDocumentVersions(getPrismaClient(), {
				documentId: input.documentId,
				leftRevision: input.leftRevision,
				rightRevision: input.rightRevision,
				workspaceId: access.workspaceId,
			});
			if (!compared) {
				throw new ORPCError("NOT_FOUND");
			}
			return compared;
		}),
	convertList: protectedWriteProcedure
		.input(
			convertListCommandSchema.omit({
				actorId: true,
				origin: true,
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await convertList(getPrismaClient(), {
				...input,
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
			});
		}),
	convertMermaid: protectedWriteProcedure
		.input(
			convertMermaidCommandSchema.omit({
				actorId: true,
				origin: true,
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await convertMermaidToTechnicalDiagram(
				getPrismaClient(),
				{
					...input,
					actorId: access.accountId,
					origin: "human",
					workspaceId: access.workspaceId,
				},
				diagramStore
			);
		}),
	convertSelection: protectedWriteProcedure
		.input(
			convertSelectionCommandSchema.omit({
				actorId: true,
				origin: true,
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await convertSelection(getPrismaClient(), {
				...input,
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
			});
		}),
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
			if (document.scope.kind === "project") {
				await requireProject(access.workspaceId, document.scope.projectId);
			}
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
			if (input.scope.kind === "project") {
				await requireProject(access.workspaceId, input.scope.projectId);
			}
			return await listDocuments(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	listTemplates: protectedProcedure
		.input(z.object({ scope: documentScopeSchema }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			if (input.scope.kind === "project") {
				await requireProject(access.workspaceId, input.scope.projectId);
			}
			return await listDocumentTemplates(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	materializeStarterSkeletons: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: materializeStarterSkeletonDocumentsPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await materializeStarterSkeletonDocuments(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	pinVersionPinnedEvidence: protectedWriteProcedure
		.input(
			pinVersionPinnedEvidenceCommandSchema.omit({
				actorId: true,
				origin: true,
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await pinVersionPinnedEvidence(getPrismaClient(), {
				...input,
				actorId: access.accountId,
				origin: "human",
				workspaceId: access.workspaceId,
			});
		}),
	present: protectedProcedure
		.input(z.object({ body: z.string() }))
		.handler(({ input }) => presentDocumentBody(input.body)),
	presentLive: protectedProcedure
		.input(
			z.object({
				body: z.string(),
				workspaceId: z.string().min(1).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await presentLiveDocumentBody(getPrismaClient(), {
				body: input.body,
				sources: { diagrams: diagramStore },
				workspaceId: access.workspaceId,
			});
		}),
	previewConvertList: protectedProcedure
		.input(
			previewConvertListInputSchema.omit({
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertList(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	previewConvertMermaid: protectedProcedure
		.input(
			previewConvertMermaidInputSchema.omit({
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertMermaid(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
	previewConvertSelection: protectedProcedure
		.input(
			previewConvertSelectionInputSchema.omit({
				workspaceId: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await previewConvertSelection(getPrismaClient(), {
				...input,
				workspaceId: access.workspaceId,
			});
		}),
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
	restore: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: restoreDocumentPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await restoreDocumentVersion(getPrismaClient(), {
				actorId: access.accountId,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
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
	versions: protectedProcedure
		.input(z.object({ documentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const versions = await listDocumentVersions(getPrismaClient(), {
				documentId: input.documentId,
				workspaceId: access.workspaceId,
			});
			if (!versions) {
				throw new ORPCError("NOT_FOUND");
			}
			return versions;
		}),
};
