import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createDailyFocus } from "./daily-focus";
import { calendarDaySchema, dailyFocusCatalog } from "./daily-focus-model";

async function focusFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createDailyFocus({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const membershipInput = z.object({
	calendarDay: calendarDaySchema.optional(),
	idempotencyKey: z.string().min(1),
	workId: z.string().min(1),
});

export const dailyFocus = {
	add: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.add(input);
		}),
	catalog: protectedProcedure.handler(() => dailyFocusCatalog()),
	closeView: protectedProcedure
		.input(z.object({ calendarDay: calendarDaySchema.optional() }))
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.closeView(input);
		}),
	remove: protectedWriteProcedure
		.input(membershipInput)
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.remove(input);
		}),
	view: protectedProcedure
		.input(z.object({ calendarDay: calendarDaySchema.optional() }))
		.handler(async ({ context, input }) => {
			const surface = await focusFor(context.session.user.id);
			return surface.view(input);
		}),
};
