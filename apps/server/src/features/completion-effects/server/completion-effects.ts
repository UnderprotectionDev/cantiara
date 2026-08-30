import { protectedProcedure, protectedWriteProcedure } from "@cantiara/api";
import {
	completionEffectPreferenceInputSchema,
	getCompletionEffectPreference,
	saveCompletionEffectPreference,
} from "@cantiara/auth";
import { getPrismaClient } from "@cantiara/db";

export const completionEffects = {
	get: protectedProcedure.handler(async ({ context }) =>
		getCompletionEffectPreference(getPrismaClient(), context.session.user.id)
	),
	save: protectedWriteProcedure
		.input(completionEffectPreferenceInputSchema)
		.handler(async ({ context, input }) =>
			saveCompletionEffectPreference(
				getPrismaClient(),
				context.session.user.id,
				input
			)
		),
};
