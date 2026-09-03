import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createReturnToWork } from "./return-to-work";
import { returnToWorkCatalog } from "./return-to-work-model";

async function surfaceFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createReturnToWork({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const contextInput = z.object({
	projectId: z.string().min(1).optional(),
	workId: z.string().min(1).optional(),
});

export const returnToWork = {
	catalog: protectedProcedure.handler(() => returnToWorkCatalog()),
	noteVisibleOpen: protectedWriteProcedure
		.input(contextInput)
		.handler(async ({ context, input }) => {
			const surface = await surfaceFor(context.session.user.id);
			return surface.noteVisibleOpen(input);
		}),
	setNextConcreteStep: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				projectId: z.string().min(1).optional(),
				text: z.string(),
				workId: z.string().min(1).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await surfaceFor(context.session.user.id);
			return surface.setNextConcreteStep(input);
		}),
	setStatusAgeThresholdDays: protectedWriteProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				thresholdDays: z.number().int().nullable(),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await surfaceFor(context.session.user.id);
			return surface.setStatusAgeThresholdDays(input);
		}),
	summary: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1),
				workId: z.string().min(1).optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await surfaceFor(context.session.user.id);
			const summary = await surface.summary(input);
			if (!summary) {
				throw new ORPCError("NOT_FOUND");
			}
			return summary;
		}),
};
