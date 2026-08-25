import { protectedProcedure } from "@cantiara/api";
import {
	accountPreferencesInputSchema,
	getAccountPreferences,
	saveAccountPreferences,
} from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";

export const accountPreferences = {
	get: protectedProcedure.handler(async ({ context }) =>
		getAccountPreferences(getPrismaClient(), context.session.user.id)
	),
	save: protectedProcedure
		.input(accountPreferencesInputSchema)
		.handler(async ({ context, input }) =>
			saveAccountPreferences(getPrismaClient(), context.session.user.id, input)
		),
};
