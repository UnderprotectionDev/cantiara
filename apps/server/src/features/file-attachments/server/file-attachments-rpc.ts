import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	cancelFileUpload,
	finalizeFileUpload,
	getFileAttachment,
	getFileQuota,
	listFileAttachments,
	previewUploadNewVersion,
	putStagingBytes,
	stageFileUpload,
} from "./file-attachments";
import {
	appendMark,
	approveSharePublishItem,
	confirmLocationWorkBind,
	getMarkingLayer,
	listSharePublishItems,
	previewLocationWorkBind,
	undoMark,
} from "./file-attachments-marking";
import {
	EXTERNAL_SURFACE_AUDIENCE,
	FILE_ATTACHMENT_COPY,
	fileScopeSchema,
	locationGeometrySchema,
	stageFileUploadCommandSchema,
} from "./file-attachments-model";
import { fileCanEnterExternalSurface } from "./file-attachments-preview";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

const scopeInput = z.object({
	scope: fileScopeSchema,
});

export const fileAttachments = {
	appendMark: protectedWriteProcedure
		.input(
			z.object({
				geometry: z.record(z.string(), z.unknown()),
				page: z.number().int().positive().optional(),
				tool: z.string().min(1),
				versionId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await appendMark(getPrismaClient(), input);
		}),
	approveSharePublishItem: protectedWriteProcedure
		.input(
			z.object({
				kind: z.string().min(1),
				versionId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await approveSharePublishItem(getPrismaClient(), input);
		}),
	bindLocation: protectedWriteProcedure
		.input(
			z.object({
				existingWorkId: z.string().min(1).optional(),
				geometry: locationGeometrySchema,
				idempotencyKey: z.string().min(1),
				previewAcknowledged: z.boolean(),
				surface: z.string().min(1),
				title: z.string().optional(),
				versionId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await confirmLocationWorkBind(getPrismaClient(), {
				actorId: access.accountId,
				existingWorkId: input.existingWorkId,
				geometry: input.geometry,
				idempotencyKey: input.idempotencyKey,
				previewAcknowledged: input.previewAcknowledged,
				surface: input.surface,
				title: input.title,
				versionId: input.versionId,
				workspaceId: access.workspaceId,
			});
		}),
	cancel: protectedWriteProcedure
		.input(z.object({ operationId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await cancelFileUpload(getPrismaClient(), input.operationId);
		}),
	catalog: protectedProcedure.handler(() => ({
		copy: FILE_ATTACHMENT_COPY,
	})),
	finalize: protectedWriteProcedure
		.input(
			stageFileUploadCommandSchema.pick({
				idempotencyKey: true,
				payload: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await finalizeFileUpload(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	get: protectedProcedure
		.input(z.object({ fileAttachmentId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const file = await getFileAttachment(getPrismaClient(), {
				id: input.fileAttachmentId,
				workspaceId: access.workspaceId,
			});
			if (!file) {
				throw new ORPCError("NOT_FOUND");
			}
			return file;
		}),
	getMarkingLayer: protectedProcedure
		.input(z.object({ versionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await getMarkingLayer(getPrismaClient(), input.versionId);
		}),
	list: protectedProcedure
		.input(scopeInput)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await listFileAttachments(getPrismaClient(), {
				scope: input.scope,
				workspaceId: access.workspaceId,
			});
		}),
	listSharePublishItems: protectedProcedure
		.input(z.object({ versionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await listSharePublishItems(getPrismaClient(), input.versionId);
		}),
	previewLocationBind: protectedProcedure
		.input(
			z.object({
				existingWork: z
					.object({ id: z.string().min(1), title: z.string().min(1) })
					.nullable()
					.optional(),
				fileKind: z.string().min(1),
				geometry: locationGeometrySchema,
				scope: z.object({
					kind: z.string().min(1),
					projectId: z.string().min(1).optional(),
				}),
				surface: z.string().min(1),
				title: z.string().optional(),
				versionId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return previewLocationWorkBind(input);
		}),
	previewNewVersion: protectedProcedure
		.input(
			z.object({
				declaredMime: z.string().min(1),
				fileAttachmentId: z.string().min(1),
				filename: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await previewUploadNewVersion(getPrismaClient(), input);
		}),
	putBytes: protectedWriteProcedure
		.input(
			z.object({
				byteOffset: z.number().int().nonnegative().optional(),
				bytesBase64: z.string().min(1),
				operationId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await putStagingBytes(getPrismaClient(), {
				byteOffset: input.byteOffset,
				bytes: Uint8Array.from(Buffer.from(input.bytesBase64, "base64")),
				operationId: input.operationId,
			});
		}),
	quota: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await getFileQuota(getPrismaClient(), access.workspaceId);
	}),
	stage: protectedWriteProcedure
		.input(
			stageFileUploadCommandSchema.pick({
				idempotencyKey: true,
				payload: true,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await stageFileUpload(getPrismaClient(), {
				actorId: access.accountId,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	undoMark: protectedWriteProcedure
		.input(z.object({ versionId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await requireAccess(context.session.user.id);
			return await undoMark(getPrismaClient(), input.versionId);
		}),
	zipExternalSurfaceAllowed: protectedProcedure
		.input(
			z.object({
				audience: z
					.enum([
						EXTERNAL_SURFACE_AUDIENCE.linkLimited,
						EXTERNAL_SURFACE_AUDIENCE.public,
					])
					.default(EXTERNAL_SURFACE_AUDIENCE.public),
				kind: z.string().min(1),
			})
		)
		.handler(({ input }) => fileCanEnterExternalSurface(input)),
};
