import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getProject } from "../../project-shell/server/project-shell";
import {
	applyLinkedBlockChange,
	archiveScreen,
	createLinkedBlock,
	createScreen,
	createScreenFromWireframeTemplate,
	detachLinkedBlock,
	getExactWireframeVersion,
	getScreen,
	listLinkedBlocks,
	listScreens,
	moveLiveCard,
	permanentlyDeleteScreen,
	previewLinkedBlockChange,
	restoreScreen,
	saveExactWireframeVersion,
	trashScreen,
	unarchiveScreen,
} from "./screens-and-wireframes";
import {
	convertAndBind,
	previewConvertAndBind,
	previewRebindOrigin,
	rebindOrigin,
	redactWireframeBlock,
	saveWireframeTemplate,
} from "./screens-and-wireframes-convert";
import {
	CONVERT_RECORD_KINDS,
	createScreenFromWireframeTemplateCommandSchema,
	createScreenPayloadSchema,
	emptyWireframeDocumentSchema,
	moveLiveCardCommandSchema,
	previewConvertAndBindInputSchema,
	previewLinkedBlockChangePayloadSchema,
	previewRebindOriginInputSchema,
	SCREENS_COPY,
} from "./screens-and-wireframes-model";
import { wireframeLinkedBlockDefinitionSchema } from "./wireframe-document";

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

async function requireScreen(workspaceId: string, screenId: string) {
	const screen = await getScreen(getPrismaClient(), screenId);
	if (!screen) {
		throw new ORPCError("NOT_FOUND");
	}
	await requireProject(workspaceId, screen.projectId);
	return screen;
}

const screenCommandInput = z.object({
	baseRevision: z.number().int().positive(),
	idempotencyKey: z.string(),
	screenId: z.string().min(1),
});

export const screensAndWireframes = {
	applyLinkedBlock: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: previewLinkedBlockChangePayloadSchema,
				previewAcknowledged: z.boolean().optional(),
				previewFingerprint: z.string().min(1).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await applyLinkedBlockChange(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
				previewFingerprint: input.previewFingerprint,
			});
		}),
	archive: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await archiveScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	catalog: protectedProcedure.handler(() => ({
		...SCREENS_COPY,
		convertRecordKinds: CONVERT_RECORD_KINDS,
	})),
	convertAndBind: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: previewConvertAndBindInputSchema.extend({
					previewFingerprint: z.string().min(1).optional(),
				}),
				previewAcknowledged: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.payload.screenId);
			return await convertAndBind(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
			});
		}),
	create: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createScreenPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createFromTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createScreenFromWireframeTemplateCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createScreenFromWireframeTemplate(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	createLinkedBlock: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: z.object({
					definition: wireframeLinkedBlockDefinitionSchema,
					name: z.string().min(1),
					projectId: z.string().min(1),
				}),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.payload.projectId);
			return await createLinkedBlock(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	detachLinkedBlock: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().positive(),
				idempotencyKey: z.string(),
				nodeId: z.string().min(1),
				screenId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await detachLinkedBlock(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: {
					nodeId: input.nodeId,
					screenId: input.screenId,
				},
			});
		}),
	get: protectedProcedure
		.input(z.object({ screenId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await requireScreen(access.workspaceId, input.screenId);
		}),
	getVersion: protectedProcedure
		.input(
			z.object({
				overlayCurrent: z.boolean().optional(),
				screenId: z.string().min(1),
				versionNumber: z.number().int().positive(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await getExactWireframeVersion(getPrismaClient(), input);
		}),
	list: protectedProcedure
		.input(
			z.object({
				includeArchived: z.boolean().optional(),
				projectId: z.string().min(1),
				trash: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listScreens(getPrismaClient(), input);
		}),
	listLinkedBlocks: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await listLinkedBlocks(getPrismaClient(), input.projectId);
		}),
	moveLiveCard: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().positive(),
				idempotencyKey: z.string(),
				payload: moveLiveCardCommandSchema.shape.payload,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.payload.screenId);
			return await moveLiveCard(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
			});
		}),
	permanentlyDelete: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await permanentlyDeleteScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	previewConvertAndBind: protectedProcedure
		.input(previewConvertAndBindInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await previewConvertAndBind(getPrismaClient(), input);
		}),
	previewLinkedBlock: protectedProcedure
		.input(previewLinkedBlockChangePayloadSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireProject(access.workspaceId, input.projectId);
			return await previewLinkedBlockChange(getPrismaClient(), input);
		}),
	previewRebindOrigin: protectedProcedure
		.input(previewRebindOriginInputSchema)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await previewRebindOrigin(getPrismaClient(), input);
		}),
	rebindOrigin: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: previewRebindOriginInputSchema.extend({
					previewFingerprint: z.string().min(1).optional(),
				}),
				previewAcknowledged: z.boolean().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.payload.screenId);
			return await rebindOrigin(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				previewAcknowledged: input.previewAcknowledged,
			});
		}),
	redactBlock: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				nodeId: z.string().min(1),
				screenId: z.string().min(1),
				versionNumber: z.number().int().positive(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await redactWireframeBlock(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: {
					nodeId: input.nodeId,
					screenId: input.screenId,
					versionNumber: input.versionNumber,
				},
			});
		}),
	restore: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await restoreScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	saveTemplate: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				name: z.string().min(1),
				screenId: z.string().min(1),
				versionNumber: z.number().int().positive(),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await saveWireframeTemplate(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: {
					name: input.name,
					screenId: input.screenId,
					versionNumber: input.versionNumber,
				},
			});
		}),
	saveVersion: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().positive(),
				document: emptyWireframeDocumentSchema,
				idempotencyKey: z.string(),
				screenId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await saveExactWireframeVersion(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: {
					document: input.document,
					screenId: input.screenId,
				},
			});
		}),
	trash: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await trashScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
	unarchive: protectedWriteProcedure
		.input(screenCommandInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			await requireScreen(access.workspaceId, input.screenId);
			return await unarchiveScreen(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: { screenId: input.screenId },
			});
		}),
};
