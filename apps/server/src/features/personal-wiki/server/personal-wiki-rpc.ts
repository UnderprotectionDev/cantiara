import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient, type PrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	copyDocument,
	createDocument,
	getDocument,
	moveDocument,
	previewDocumentMove,
} from "../../documents/server/documents";
import type { DocumentView } from "../../documents/server/documents-model";
import {
	copyIntoWiki,
	type DocumentsPort,
	moveToWiki,
	openPersonalWikiShell,
	PERSONAL_WIKI_DOCUMENT_COMMANDS,
	PERSONAL_WIKI_RECORD_KIND,
	PERSONAL_WIKI_SCOPE,
	previewMoveToWiki,
	type WikiDocument,
	type WikiMovePreview,
	type WikiWriteOutcome,
} from "./personal-wiki";

function toWikiDocument(view: DocumentView): WikiDocument {
	return {
		body: view.body,
		id: view.id,
		originDocumentId: view.originDocumentId,
		parentId: view.parentId,
		recordKind: PERSONAL_WIKI_RECORD_KIND,
		scope: view.scope,
		title: view.title,
		type: view.type,
	};
}

function toWriteOutcome(
	outcome: Awaited<ReturnType<typeof copyDocument>>
): WikiWriteOutcome {
	if (outcome.status === "committed" || outcome.status === "replayed") {
		return {
			document: toWikiDocument(outcome.document),
			status: outcome.status,
		};
	}
	if (outcome.status === "rejected") {
		return { reason: outcome.reason, status: "rejected" };
	}
	return { conflict: "Conflict", status: "conflict" };
}

export function documentsPortForWiki(
	prisma: PrismaClient,
	options: { actorId: string; workspaceId: string }
): DocumentsPort {
	return {
		commands: () => PERSONAL_WIKI_DOCUMENT_COMMANDS,
		async copy(input) {
			return toWriteOutcome(
				await copyDocument(prisma, {
					actorId: options.actorId,
					idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
					origin: "human",
					payload: {
						documentId: input.documentId,
						target: PERSONAL_WIKI_SCOPE,
						versionRevision: input.versionRevision,
					},
					workspaceId: options.workspaceId,
				})
			);
		},
		async create(input) {
			const outcome = await createDocument(prisma, {
				actorId: options.actorId,
				idempotencyKey: crypto.randomUUID(),
				origin: "human",
				payload: {
					body: input.body,
					scope: input.scope,
					title: input.title,
					type: input.type,
				},
				workspaceId: options.workspaceId,
			});
			if (outcome.status !== "committed" && outcome.status !== "replayed") {
				return { reason: "project-scope-forbidden", status: "rejected" };
			}
			return {
				document: toWikiDocument(outcome.document),
				status: "committed",
			};
		},
		async move(input) {
			const current = await getDocument(prisma, input.documentId);
			if (!current) {
				return { reason: "document-not-found", status: "rejected" };
			}
			return toWriteOutcome(
				await moveDocument(prisma, {
					actorId: options.actorId,
					baseRevision: input.baseRevision ?? current.revision,
					idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
					origin: "human",
					payload: {
						cancelExternalSurfaces: input.cancelExternalSurfaces,
						childDocumentIds: [...input.childDocumentIds],
						documentId: input.documentId,
						target: PERSONAL_WIKI_SCOPE,
					},
					workspaceId: options.workspaceId,
				})
			);
		},
		async previewMove(input): Promise<WikiMovePreview> {
			const preview = await previewDocumentMove(prisma, {
				childDocumentIds: [...input.childDocumentIds],
				documentId: input.documentId,
				target: PERSONAL_WIKI_SCOPE,
				workspaceId: options.workspaceId,
			});
			if (preview.status !== "ok") {
				return preview;
			}
			return {
				detachedChildIds: preview.detachedChildIds,
				selectedDocumentIds: preview.selectedDocumentIds,
				status: "ok",
				target: PERSONAL_WIKI_SCOPE,
			};
		},
	};
}

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

async function documentsForUser(userId: string) {
	const access = await requireAccess(userId);
	return documentsPortForWiki(getPrismaClient(), {
		actorId: access.accountId,
		workspaceId: access.workspaceId,
	});
}

export const personalWiki = {
	copy: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				payload: z.object({
					documentId: z.string().min(1),
					versionRevision: z.number().int().positive().optional(),
				}),
			})
		)
		.handler(async ({ context, input }) => {
			const documents = await documentsForUser(context.session.user.id);
			return await copyIntoWiki(documents, {
				documentId: input.payload.documentId,
				idempotencyKey: input.idempotencyKey,
				versionRevision: input.payload.versionRevision,
			});
		}),
	move: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string().min(1),
				payload: z.object({
					cancelExternalSurfaces: z.boolean().optional(),
					childDocumentIds: z.array(z.string().min(1)).default([]),
					documentId: z.string().min(1),
				}),
			})
		)
		.handler(async ({ context, input }) => {
			const documents = await documentsForUser(context.session.user.id);
			return await moveToWiki(documents, {
				baseRevision: input.baseRevision,
				cancelExternalSurfaces: input.payload.cancelExternalSurfaces,
				childDocumentIds: input.payload.childDocumentIds,
				documentId: input.payload.documentId,
				idempotencyKey: input.idempotencyKey,
			});
		}),
	previewMove: protectedProcedure
		.input(
			z.object({
				childDocumentIds: z.array(z.string().min(1)).default([]),
				documentId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const documents = await documentsForUser(context.session.user.id);
			return await previewMoveToWiki(documents, input);
		}),
	shell: protectedProcedure.handler(() => openPersonalWikiShell()),
};
