import { protectedProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createUnifiedCalendar } from "./unified-calendar";
import {
	calendarDaySchema,
	calendarViewNameSchema,
	unifiedCalendarCatalog,
} from "./unified-calendar-model";

async function calendarFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createUnifiedCalendar({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

export const unifiedCalendar = {
	catalog: protectedProcedure.handler(() => unifiedCalendarCatalog()),
	view: protectedProcedure
		.input(
			z.object({
				calendarDay: calendarDaySchema.optional(),
				projectId: z.string().min(1).nullable().optional(),
				view: calendarViewNameSchema.optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await calendarFor(context.session.user.id);
			return surface.view(input);
		}),
};
