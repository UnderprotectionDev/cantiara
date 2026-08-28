import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createWorkDrafts, workDraftsCatalog } from "./work-drafts";
import { workDraftFormSchema } from "./work-drafts-model";

async function draftsFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createWorkDrafts({
		actorId: userId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

export const workDrafts = {
	autosave: protectedWriteProcedure
		.input(
			z.object({
				draftId: z.string().min(1).optional(),
				form: workDraftFormSchema,
				idempotencyKey: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const drafts = await draftsFor(context.session.user.id);
			return drafts.autosave(input);
		}),
	catalog: protectedProcedure.handler(() => workDraftsCatalog()),
	delete: protectedWriteProcedure
		.input(
			z.object({
				draftId: z.string().min(1),
				idempotencyKey: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const drafts = await draftsFor(context.session.user.id);
			return drafts.deleteDraft(input);
		}),
	finalize: protectedWriteProcedure
		.input(
			z.object({
				draftId: z.string().min(1).optional(),
				form: workDraftFormSchema,
				idempotencyKey: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const drafts = await draftsFor(context.session.user.id);
			return drafts.finalize(input);
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const drafts = await draftsFor(context.session.user.id);
		return drafts.list();
	}),
	resume: protectedProcedure
		.input(z.object({ draftId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const drafts = await draftsFor(context.session.user.id);
			const draft = await drafts.resume(input.draftId);
			if (!draft) {
				throw new ORPCError("NOT_FOUND");
			}
			return draft;
		}),
	workCustomFields: protectedProcedure
		.input(z.object({ projectId: z.string().min(1).nullable() }))
		.handler(async ({ context, input }) => {
			const drafts = await draftsFor(context.session.user.id);
			return drafts.workCustomFields(input.projectId);
		}),
};
