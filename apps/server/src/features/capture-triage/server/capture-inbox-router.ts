import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	captureInboxCatalog,
	createCaptureInbox,
	handOffWorkCreate,
} from "./capture-inbox";
import { miniTemplateIdSchema } from "./capture-inbox-model";
import {
	bindRelationSchema,
	convertTargetKindSchema,
} from "./capture-triage-exits";

const fieldsSchema = z.record(z.string(), z.string());
const attachmentSchema = z.object({
	bytesBase64: z.string().min(1),
	contentType: z.string().min(1),
	filename: z.string().min(1),
});

function decodeAttachment(input: z.infer<typeof attachmentSchema>) {
	return {
		bytes: Uint8Array.from(Buffer.from(input.bytesBase64, "base64")),
		contentType: input.contentType,
		filename: input.filename,
	};
}

async function inboxFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createCaptureInbox({
		actorId: userId,
		prisma: getPrismaClient(),
		workCreate: handOffWorkCreate,
		workspaceId: access.workspaceId,
	});
}

export const captureInbox = {
	attach: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				itemId: z.string().min(1),
				previewed: z.boolean(),
				relation: bindRelationSchema,
				targetId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.attach(input);
		}),
	catalog: protectedProcedure.handler(() => captureInboxCatalog()),
	convert: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				itemId: z.string().min(1),
				previewed: z.boolean(),
				targetKind: convertTargetKindSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.convert(input);
		}),
	createBug: protectedWriteProcedure
		.input(
			z.object({
				fields: fieldsSchema.optional(),
				idempotencyKey: z.string().min(1),
				projectId: z.string().min(1),
				template: miniTemplateIdSchema.optional(),
				text: z.string().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.createBug(input);
		}),
	deleteItem: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				itemId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.deleteItem(input);
		}),
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.list(
				input.projectId
					? { kind: "project", projectId: input.projectId }
					: { kind: "workspace" }
			);
		}),
	listAll: protectedProcedure.handler(async ({ context }) => {
		const inbox = await inboxFor(context.session.user.id);
		return inbox.listAll();
	}),
	previewAttach: protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				relation: bindRelationSchema,
				targetId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.previewAttach(input);
		}),
	previewConvert: protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				targetKind: convertTargetKindSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.previewConvert(input);
		}),
	previewUndoMerge: protectedProcedure
		.input(
			z.object({
				mergeId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.previewUndoMerge(input);
		}),
	save: protectedWriteProcedure
		.input(
			z.object({
				attachment: attachmentSchema.optional(),
				attachmentRef: z.string().min(1).optional(),
				fields: fieldsSchema.optional(),
				idempotencyKey: z.string().min(1),
				link: z.string().optional(),
				origin: z.string().optional(),
				projectId: z.string().min(1).optional(),
				template: miniTemplateIdSchema.optional(),
				text: z.string().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.save({
				...input,
				attachment: input.attachment
					? decodeAttachment(input.attachment)
					: undefined,
			});
		}),
	stageAttachment: protectedWriteProcedure
		.input(
			z.object({
				attachment: attachmentSchema,
				idempotencyKey: z.string().min(1),
				itemId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.stageAttachment({
				attachment: decodeAttachment(input.attachment),
				idempotencyKey: input.idempotencyKey,
				itemId: input.itemId,
			});
		}),
	suggestSimilar: protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.suggestSimilar(input);
		}),
	undoMerge: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				mergeId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.undoMerge(input);
		}),
};
