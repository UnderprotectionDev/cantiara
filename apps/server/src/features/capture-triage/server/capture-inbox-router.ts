import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import {
	CAPTURE_INBOX_COPY,
	createCaptureInbox,
	handOffWorkCreate,
	miniTemplateCatalog,
	miniTemplateIdSchema,
} from "./capture-inbox";

const fieldsSchema = z.record(z.string(), z.string());

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
	catalog: protectedProcedure.handler(() => ({
		copy: CAPTURE_INBOX_COPY,
		templates: miniTemplateCatalog(),
	})),
	createBug: protectedWriteProcedure
		.input(
			z.object({
				fields: fieldsSchema.optional(),
				idempotencyKey: z.string().min(1),
				projectId: z.string().min(1),
				text: z.string().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.createBug(input);
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
	save: protectedWriteProcedure
		.input(
			z.object({
				fields: fieldsSchema.optional(),
				idempotencyKey: z.string().min(1),
				projectId: z.string().min(1).optional(),
				template: miniTemplateIdSchema.optional(),
				text: z.string().optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const inbox = await inboxFor(context.session.user.id);
			return inbox.save(input);
		}),
};
