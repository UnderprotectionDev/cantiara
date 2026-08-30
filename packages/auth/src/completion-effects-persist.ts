import type { PrismaClient } from "@cantiara/db";

import {
	type CompletionEffectPreference,
	type CompletionEffectPreferenceInput,
	completionEffectPreferenceInputSchema,
	defaultCompletionEffectPreference,
} from "./completion-effects-model";

export async function getCompletionEffectPreference(
	prisma: PrismaClient,
	accountId: string
): Promise<CompletionEffectPreference> {
	const row = await prisma.completionEffectPreference.findUnique({
		where: { accountId },
	});
	if (!row) {
		return defaultCompletionEffectPreference();
	}
	const parsed = completionEffectPreferenceInputSchema.safeParse({
		enabled: row.enabled,
		palette: row.palette,
		theme: row.theme,
	});
	if (!parsed.success) {
		return defaultCompletionEffectPreference();
	}
	return parsed.data;
}

export async function saveCompletionEffectPreference(
	prisma: PrismaClient,
	accountId: string,
	input: CompletionEffectPreferenceInput
): Promise<CompletionEffectPreference> {
	const parsed = completionEffectPreferenceInputSchema.parse(input);
	await prisma.completionEffectPreference.upsert({
		create: {
			accountId,
			enabled: parsed.enabled,
			id: crypto.randomUUID(),
			palette: parsed.palette,
			theme: parsed.theme,
		},
		update: {
			enabled: parsed.enabled,
			palette: parsed.palette,
			theme: parsed.theme,
		},
		where: { accountId },
	});
	return parsed;
}
