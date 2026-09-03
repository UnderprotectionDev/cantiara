import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createProjectGoals } from "./project-goals";
import { projectGoalCatalog } from "./project-goals-model";

async function goalsFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createProjectGoals({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const createInput = z.object({
	description: z.string(),
	idempotencyKey: z.string().min(1),
	intendedOutcome: z.string().optional(),
	observedOutcome: z.string().optional(),
	projectId: z.string().min(1),
	title: z.string(),
});

const updateInput = z.object({
	description: z.string(),
	goalId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	intendedOutcome: z.string().optional(),
	observedOutcome: z.string().optional(),
	title: z.string(),
});

export const projectGoals = {
	catalog: protectedProcedure.handler(() => projectGoalCatalog()),
	create: protectedWriteProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const surface = await goalsFor(context.session.user.id);
			return surface.create(input);
		}),
	get: protectedProcedure
		.input(z.object({ goalId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await goalsFor(context.session.user.id);
			return surface.get(input.goalId);
		}),
	list: protectedProcedure
		.input(z.object({ projectId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await goalsFor(context.session.user.id);
			return surface.list(input.projectId);
		}),
	update: protectedWriteProcedure
		.input(updateInput)
		.handler(async ({ context, input }) => {
			const surface = await goalsFor(context.session.user.id);
			return surface.update(input);
		}),
};
