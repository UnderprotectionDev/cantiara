import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createFocusPeriod } from "./focus-period";
import { calendarDaySchema, focusPeriodCatalog } from "./focus-period-model";

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
	create: protectedWriteProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.create(input);
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
	remove: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.remove(input);
		}),
};
