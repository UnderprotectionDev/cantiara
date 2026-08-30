import type { PrismaClient } from "@cantiara/db";

import {
	type CompletionEffectPreference,
	type CompletionEffectPreferenceInput,
	completionEffectPreferenceInputSchema,
	defaultCompletionEffectPreference,
} from "./completion-effects-model";

// bun --hot can keep a PrismaClient generated before CompletionEffectPreference.
// Table SQL still reads and writes Hesap preference when the delegate is missing.
type PreferenceStore = Pick<PrismaClient, "$executeRaw" | "$queryRaw"> & {
	completionEffectPreference?: PrismaClient["completionEffectPreference"];
};

function hasPreferenceDelegate(
	prisma: PreferenceStore
): prisma is PreferenceStore & {
	completionEffectPreference: PrismaClient["completionEffectPreference"];
} {
	return typeof prisma.completionEffectPreference?.findUnique === "function";
}

function parseStoredPreference(row: {
	enabled: boolean;
	palette: string;
	theme: string;
}): CompletionEffectPreference {
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

export async function getCompletionEffectPreference(
	prisma: PreferenceStore,
	accountId: string
): Promise<CompletionEffectPreference> {
	if (hasPreferenceDelegate(prisma)) {
		const row = await prisma.completionEffectPreference.findUnique({
			where: { accountId },
		});
		if (!row) {
			return defaultCompletionEffectPreference();
		}
		return parseStoredPreference(row);
	}
	const rows = await prisma.$queryRaw<
		Array<{ enabled: boolean; palette: string; theme: string }>
	>`
		SELECT enabled, palette, theme
		FROM "completion_effect_preference"
		WHERE "accountId" = ${accountId}
		LIMIT 1
	`;
	const [row] = rows;
	if (!row) {
		return defaultCompletionEffectPreference();
	}
	return parseStoredPreference(row);
}

export async function saveCompletionEffectPreference(
	prisma: PreferenceStore,
	accountId: string,
	input: CompletionEffectPreferenceInput
): Promise<CompletionEffectPreference> {
	const parsed = completionEffectPreferenceInputSchema.parse(input);
	if (hasPreferenceDelegate(prisma)) {
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
	const now = new Date();
	await prisma.$executeRaw`
		INSERT INTO "completion_effect_preference" (
			id,
			"accountId",
			enabled,
			theme,
			palette,
			"createdAt",
			"updatedAt"
		)
		VALUES (
			${crypto.randomUUID()},
			${accountId},
			${parsed.enabled},
			${parsed.theme},
			${parsed.palette},
			${now},
			${now}
		)
		ON CONFLICT ("accountId") DO UPDATE SET
			enabled = EXCLUDED.enabled,
			theme = EXCLUDED.theme,
			palette = EXCLUDED.palette,
			"updatedAt" = EXCLUDED."updatedAt"
	`;
	return parsed;
}
