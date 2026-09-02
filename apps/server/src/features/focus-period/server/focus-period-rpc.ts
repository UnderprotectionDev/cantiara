import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createFocusPeriod } from "./focus-period";
import {
	calendarDaySchema,
	FOCUS_PERIOD_LEFTOVER_DESTINATIONS,
	focusPeriodCatalog,
} from "./focus-period-model";

async function focusFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createFocusPeriod({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const createInput = z.object({
	endDate: calendarDaySchema,
	idempotencyKey: z.string().min(1),
	purpose: z.string().min(1),
	startDate: calendarDaySchema,
});

const membershipInput = z.object({
	idempotencyKey: z.string().min(1),
	periodId: z.string().min(1),
	workId: z.string().min(1),
});

const periodInput = z.object({
	idempotencyKey: z.string().min(1),
	periodId: z.string().min(1),
});

const leftoverInput = z.object({
	idempotencyKey: z.string().min(1),
	periodId: z.string().min(1),
	selections: z.array(
		z.object({
			destination: z.enum(FOCUS_PERIOD_LEFTOVER_DESTINATIONS),
			periodId: z.string().min(1).optional(),
			workId: z.string().min(1),
		})
	),
});

const evaluateInput = z.object({
	change: z.string().optional(),
	idempotencyKey: z.string().min(1),
	keep: z.string().optional(),
	periodId: z.string().min(1),
	skipped: z.boolean(),
	tryNext: z.string().optional(),
});

const followUpInput = z.object({
	idempotencyKey: z.string().min(1),
	periodId: z.string().min(1),
	previewAcknowledged: z.boolean().optional(),
	projectId: z.string().min(1),
	title: z.string(),
});

export const focusPeriod = {
	add: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.add(input);
		}),
	cancel: protectedWriteProcedure
		.input(periodInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.cancel(input);
		}),
	catalog: protectedProcedure.handler(() => focusPeriodCatalog()),
	close: protectedWriteProcedure
		.input(periodInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.close(input);
		}),
	confirmFollowUp: protectedWriteProcedure
		.input(followUpInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.confirmFollowUp(input);
		}),
	create: protectedWriteProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.create(input);
		}),
	decideStillOpen: protectedWriteProcedure
		.input(leftoverInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.decideStillOpen(input);
		}),
	evaluate: protectedWriteProcedure
		.input(evaluateInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.evaluate(input);
		}),
	get: protectedProcedure
		.input(z.object({ periodId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.get(input.periodId);
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const surface = await focusFor(context.session.user.id);
		return surface.list();
	}),
	move: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.move(input);
		}),
	previewFollowUp: protectedProcedure
		.input(followUpInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.previewFollowUp(input);
		}),
	remove: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.remove(input);
		}),
};
