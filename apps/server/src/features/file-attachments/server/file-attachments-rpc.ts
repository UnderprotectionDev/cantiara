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
	zipCanEnterExternalSurface,
} from "./file-attachments";
import {
	FILE_ATTACHMENT_COPY,
	fileScopeSchema,
	stageFileUploadCommandSchema,
} from "./file-attachments-model";

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
			const file = await getFileAttachment(
				getPrismaClient(),
				input.fileAttachmentId
			);
			if (!file) {
				throw new ORPCError("NOT_FOUND");
			}
			const listed = await listFileAttachments(getPrismaClient(), {
				scope: file.scope,
				workspaceId: access.workspaceId,
			});
			if (!listed.some((item) => item.id === file.id)) {
				const owned = await getFileAttachment(
					getPrismaClient(),
					input.fileAttachmentId
				);
				if (!owned) {
					throw new ORPCError("NOT_FOUND");
				}
			}
			return file;
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
	zipExternalSurfaceAllowed: protectedProcedure
		.input(z.object({ kind: z.string().min(1) }))
		.handler(({ input }) => zipCanEnterExternalSurface(input.kind)),
};
