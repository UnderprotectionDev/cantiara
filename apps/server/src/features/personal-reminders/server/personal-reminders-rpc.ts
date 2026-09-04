import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import { getAccountAccessForUser } from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { createPersonalReminders } from "./personal-reminders";
import {
	PERSONAL_REMINDER_ACTIONS,
	PERSONAL_REMINDER_CONDITIONS,
	PERSONAL_REMINDER_SOURCE_TYPES,
	personalRemindersCatalog,
} from "./personal-reminders-model";

async function remindersFor(userId: string) {
	const access = await getAccountAccessForUser(getPrismaClient(), userId);
	if (!access) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return createPersonalReminders({
		accountId: access.accountId,
		prisma: getPrismaClient(),
		workspaceId: access.workspaceId,
	});
}

const createInput = z.object({
	createdByAction: z.enum(PERSONAL_REMINDER_ACTIONS),
	documentSectionId: z.string().min(1).nullable().optional(),
	fireAt: z.string().min(1),
	idempotencyKey: z.string().min(1),
	sourceId: z.string(),
	sourceType: z.enum(PERSONAL_REMINDER_SOURCE_TYPES),
	stillOpenCondition: z.enum(PERSONAL_REMINDER_CONDITIONS).optional(),
});

const cancelInput = z.object({
	idempotencyKey: z.string().min(1),
	reminderId: z.string().min(1),
});

const sourceInput = z.object({
	sourceId: z.string().min(1),
	sourceType: z.enum(PERSONAL_REMINDER_SOURCE_TYPES),
});

export const personalReminders = {
	cancel: protectedWriteProcedure
		.input(cancelInput)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.cancel(input);
		}),
	catalog: protectedProcedure.handler(() => personalRemindersCatalog()),
	create: protectedWriteProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.create(input);
		}),
	createFromReassessImpact: protectedWriteProcedure
		.input(
			z.object({
				fireAt: z.string().nullable(),
				idempotencyKey: z.string().min(1),
				projectReleaseId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.createFromReassessImpact(input);
		}),
	dismiss: protectedWriteProcedure
		.input(
			z.object({
				idempotencyKey: z.string().min(1),
				reminderId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.dismiss(input);
		}),
	evaluateCondition: protectedProcedure
		.input(z.object({ reminderId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.evaluateCondition(input.reminderId);
		}),
	fireDue: protectedWriteProcedure.handler(async ({ context }) => {
		const surface = await remindersFor(context.session.user.id);
		await surface.fireDue();
		return { status: "committed" as const };
	}),
	get: protectedProcedure
		.input(z.object({ reminderId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.get(input.reminderId);
		}),
	history: protectedProcedure
		.input(z.object({ reminderId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.history(input.reminderId);
		}),
	list: protectedProcedure.handler(async ({ context }) => {
		const surface = await remindersFor(context.session.user.id);
		return surface.list();
	}),
	listDue: protectedProcedure.handler(async ({ context }) => {
		const surface = await remindersFor(context.session.user.id);
		return surface.listDue();
	}),
	listForSource: protectedProcedure
		.input(sourceInput)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.listForSource(input);
		}),
	listSignals: protectedProcedure.handler(async ({ context }) => {
		const surface = await remindersFor(context.session.user.id);
		return surface.listSignals();
	}),
	openTarget: protectedProcedure
		.input(z.object({ reminderId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.openTarget(input.reminderId);
		}),
	reschedule: protectedWriteProcedure
		.input(
			z.object({
				fireAt: z.string().min(1),
				idempotencyKey: z.string().min(1),
				reminderId: z.string().min(1),
			})
		)
		.handler(async ({ context, input }) => {
			const surface = await remindersFor(context.session.user.id);
			return surface.reschedule(input);
		}),
};
