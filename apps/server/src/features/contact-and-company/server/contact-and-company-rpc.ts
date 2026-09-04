import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	createCompany,
	createContact,
	getCompany,
	getContact,
	listCompanies,
	listContacts,
	listDuplicateCandidates,
	mergeContacts,
	previewContactMerge,
	previewContactMergeUndo,
	relateContactPersona,
	searchContacts,
	setContactCompany,
	undoMergeContacts,
} from "./contact-and-company";
import {
	CONTACT_AND_COMPANY_COPY,
	contactMergeFieldChoicesSchema,
	createCompanyPayloadSchema,
	createContactPayloadSchema,
	previewContactMergeInputSchema,
	previewContactMergeUndoInputSchema,
	relateContactPersonaPayloadSchema,
	setContactCompanyPayloadSchema,
} from "./contact-and-company-model";

async function requireAccess(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return access;
}

export const contactAndCompany = {
	catalog: protectedProcedure.handler(() => CONTACT_AND_COMPANY_COPY),
	createCompany: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createCompanyPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createCompany(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	createContact: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: createContactPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await createContact(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	getCompany: protectedProcedure
		.input(z.object({ companyId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const company = await getCompany(
				getPrismaClient(),
				input.companyId,
				access.workspaceId
			);
			if (!company) {
				throw new ORPCError("NOT_FOUND");
			}
			return company;
		}),
	getContact: protectedProcedure
		.input(z.object({ contactId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const contact = await getContact(
				getPrismaClient(),
				input.contactId,
				access.workspaceId
			);
			if (!contact) {
				throw new ORPCError("NOT_FOUND");
			}
			return contact;
		}),
	listCompanies: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listCompanies(getPrismaClient(), access.workspaceId);
	}),
	listContacts: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listContacts(getPrismaClient(), access.workspaceId);
	}),
	listDuplicateCandidates: protectedProcedure.handler(async ({ context }) => {
		const access = await requireAccess(context.session.user.id);
		return await listDuplicateCandidates(getPrismaClient(), access.workspaceId);
	}),
	merge: protectedWriteProcedure
		.input(
			z.object({
				duplicateBaseRevision: z.number().int().nonnegative(),
				duplicateId: z.string().min(1),
				fieldChoices: contactMergeFieldChoicesSchema.optional(),
				idempotencyKey: z.string(),
				previewAcknowledged: z.boolean().optional(),
				survivorBaseRevision: z.number().int().nonnegative(),
				survivorId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await mergeContacts(getPrismaClient(), {
				actorId: context.session.user.id,
				duplicateBaseRevision: input.duplicateBaseRevision,
				duplicateId: input.duplicateId,
				fieldChoices: input.fieldChoices,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				previewAcknowledged: input.previewAcknowledged,
				survivorBaseRevision: input.survivorBaseRevision,
				survivorId: input.survivorId,
				workspaceId: access.workspaceId,
			});
		}),
	previewMerge: protectedProcedure
		.input(previewContactMergeInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const preview = await previewContactMerge(getPrismaClient(), {
				duplicateId: input.duplicateId,
				survivorId: input.survivorId,
				workspaceId: access.workspaceId,
			});
			if ("reason" in preview) {
				throw new ORPCError("BAD_REQUEST");
			}
			return preview;
		}),
	previewUndoMerge: protectedProcedure
		.input(previewContactMergeUndoInputSchema.omit({ workspaceId: true }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			const preview = await previewContactMergeUndo(getPrismaClient(), {
				mergeEventId: input.mergeEventId,
				survivorId: input.survivorId,
				workspaceId: access.workspaceId,
			});
			if ("reason" in preview) {
				throw new ORPCError("BAD_REQUEST");
			}
			return preview;
		}),
	relatePersona: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				payload: relateContactPersonaPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await relateContactPersona(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	searchContacts: protectedProcedure
		.input(z.object({ text: z.string() }))
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await searchContacts(
				getPrismaClient(),
				access.workspaceId,
				input.text
			);
		}),
	setCompany: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				idempotencyKey: z.string(),
				payload: setContactCompanyPayloadSchema,
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await setContactCompany(getPrismaClient(), {
				actorId: context.session.user.id,
				baseRevision: input.baseRevision,
				idempotencyKey: input.idempotencyKey,
				origin: "human",
				payload: input.payload,
				workspaceId: access.workspaceId,
			});
		}),
	undoMerge: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string(),
				mergeEventId: z.string().min(1),
				previewAcknowledged: z.boolean().optional(),
				survivorBaseRevision: z.number().int().nonnegative(),
				survivorId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const access = await requireAccess(context.session.user.id);
			return await undoMergeContacts(getPrismaClient(), {
				actorId: context.session.user.id,
				idempotencyKey: input.idempotencyKey,
				mergeEventId: input.mergeEventId,
				origin: "human",
				previewAcknowledged: input.previewAcknowledged,
				survivorBaseRevision: input.survivorBaseRevision,
				survivorId: input.survivorId,
				workspaceId: access.workspaceId,
			});
		}),
};
