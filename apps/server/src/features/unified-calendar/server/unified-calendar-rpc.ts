import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createUnifiedCalendar } from "./unified-calendar";
import {
	calendarDateKindSchema,
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

const dateMoveInput = z.object({
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	kind: calendarDateKindSchema,
	toDate: calendarDaySchema,
	workId: z.string().min(1),
});

export const unifiedCalendar = {
	catalog: protectedProcedure.handler(() => unifiedCalendarCatalog()),
	moveRepresentedDate: protectedWriteProcedure
		.input(dateMoveInput)
		.handler(async ({ context, input }) => {
			const surface = await calendarFor(context.session.user.id);
			return surface.moveRepresentedDate(input);
		}),
	previewDateMove: protectedProcedure
		.input(
			z.object({
				kind: calendarDateKindSchema,
				toDate: calendarDaySchema,
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await calendarFor(context.session.user.id);
			return surface.previewDateMove(input);
		}),
	undoRepresentedDateMove: protectedWriteProcedure
		.input(
			z.object({
				baseRevision: z.number().int().nonnegative(),
				historyEntryId: z.string().min(1),
				idempotencyKey: z.string().min(1),
				workId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await calendarFor(context.session.user.id);
			return surface.undoRepresentedDateMove(input);
		}),
	view: protectedProcedure
		.input(
			z.object({
				calendarDay: calendarDaySchema.optional(),
				dateKinds: z.array(calendarDateKindSchema).optional(),
				projectId: z.string().min(1).nullable().optional(),
				view: calendarViewNameSchema.optional(),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await calendarFor(context.session.user.id);
			return surface.view(input);
		}),
};
