import {
	protectedProcedure,
	protectedWriteProcedure,
	publicProcedure,
} from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	captureConvertAdapter,
	captureInboxCatalog,
	createCaptureInbox,
	handOffWorkCreate,
} from "./capture-inbox";
import {
	CAPTURE_INBOX_COPY,
	miniTemplateIdSchema,
} from "./capture-inbox-model";
import {
	bindRelationSchema,
	convertTargetKindSchema,
} from "./capture-triage-exits";
import { findExtensionLinkByToken, pairExtensionWithCode } from "./web-capture";
import { WEB_CAPTURE_CLIP_KINDS } from "./web-capture-model";

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

const clipSchema = z.object({
	kind: z.enum(WEB_CAPTURE_CLIP_KINDS),
	originUrl: z.string().min(1),
	screenshot: z.string().optional(),
	selectedImage: z.string().optional(),
	selectedText: z.string().optional(),
});

const targetInputSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("workspace") }),
	z.object({
		kind: z.literal("project"),
		projectId: z.string().min(1),
		projectName: z.string().min(1),
	}),
]);

function bearerToken(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (!header) {
		return null;
	}
	const [scheme, token] = header.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}
	return token;
}

function targetFromInput(input: z.infer<typeof targetInputSchema>):
	| {
			kind: "workspace";
			label: typeof CAPTURE_INBOX_COPY.workspaceCaptureInbox;
	  }
	| {
			kind: "project";
			label: typeof CAPTURE_INBOX_COPY.projectCaptureInbox;
			projectId: string;
			projectName: string;
	  } {
	if (input.kind === "workspace") {
		return {
			kind: "workspace",
			label: CAPTURE_INBOX_COPY.workspaceCaptureInbox,
		};
	}
	return {
		kind: "project",
		label: CAPTURE_INBOX_COPY.projectCaptureInbox,
		projectId: input.projectId,
		projectName: input.projectName,
	};
}

async function inboxFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createCaptureInbox({
		actorId: userId,
		convertCreate: captureConvertAdapter(getPrismaClient(), access.workspaceId),
		prisma: getPrismaClient(),
		workCreate: handOffWorkCreate,
		workspaceId: access.workspaceId,
	});
}

async function inboxForExtension(request: Request) {
	const token = bearerToken(request);
	if (!token) {
		throw new ORPCError("UNAUTHORIZED");
	}
	const link = await findExtensionLinkByToken(getPrismaClient(), token);
	if (!link || link.revokedAt) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return {
		inbox: createCaptureInbox({
			actorId: link.ownerId,
			convertCreate: captureConvertAdapter(getPrismaClient(), link.workspaceId),
			prisma: getPrismaClient(),
			workCreate: handOffWorkCreate,
			workspaceId: link.workspaceId,
		}),
		token,
	};
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
	bulkSenseMaking: protectedProcedure.handler(async ({ context }) => {
		const inbox = await inboxFor(context.session.user.id);
		return inbox.bulkSenseMaking();
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
	finalizeWebCapture: publicProcedure
		.input(z.object({ stagingId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const { inbox } = await inboxForExtension(context.request);
			return inbox.finalizeWebCapture(input);
		}),
	issuePairingCode: protectedWriteProcedure.handler(async ({ context }) => {
		const inbox = await inboxFor(context.session.user.id);
		return inbox.issuePairingCode();
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
	listExtensionLinks: protectedProcedure.handler(async ({ context }) => {
		const inbox = await inboxFor(context.session.user.id);
		return inbox.listExtensionLinks();
	}),
	nameBulkCluster: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				name: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.nameBulkCluster(input);
		}),
	pair: publicProcedure
		.input(
			z.object({
				browser: z.string().min(1),
				code: z.string().min(1),
				device: z.string().min(1),
				family: z.string().min(1),
			})
		)
		.handler(({ input }) =>
			pairExtensionWithCode(
				getPrismaClient(),
				{
					now: () => new Date(),
				},
				input
			)
		),
	placeInBulk: protectedWriteProcedure
		.input(
			z.object({
				clusterId: z.string().min(1).nullable(),
				idempotencyKey: z.string().min(1),
				itemId: z.string().min(1),
				position: z.object({
					x: z.number(),
					y: z.number(),
				}),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.placeInBulk(input);
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
	previewWebCapture: publicProcedure
		.input(
			z.object({
				clip: clipSchema,
				target: targetInputSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const { inbox } = await inboxForExtension(context.request);
			return inbox.previewWebCapture({
				clip: input.clip,
				target: targetFromInput(input.target),
			});
		}),
	revokeAllExtensionLinks: protectedWriteProcedure.handler(
		async ({ context }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.revokeAllExtensionLinks();
		}
	),
	revokeExtensionLink: protectedWriteProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.revokeExtensionLink(input);
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
	searchCaptureTargets: publicProcedure
		.input(z.object({ query: z.string().optional() }))
		.handler(async ({ context, input }) => {
			const { inbox } = await inboxForExtension(context.request);
			return inbox.searchCaptureTargets(input);
		}),
	sendWebCapture: publicProcedure
		.input(
			z.object({
				clip: clipSchema,
				idempotencyKey: z.string().min(1),
				target: targetInputSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const { inbox, token } = await inboxForExtension(context.request);
			return inbox.sendWebCapture({
				clip: input.clip,
				idempotencyKey: input.idempotencyKey,
				target: targetFromInput(input.target),
				token,
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
	stageWebCapture: publicProcedure
		.input(
			z.object({
				clip: clipSchema,
				idempotencyKey: z.string().min(1),
				target: targetInputSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const { inbox, token } = await inboxForExtension(context.request);
			return inbox.stageWebCapture({
				clip: input.clip,
				idempotencyKey: input.idempotencyKey,
				target: targetFromInput(input.target),
				token,
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
