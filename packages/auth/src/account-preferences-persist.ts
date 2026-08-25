import type { PrismaClient } from "@cantiara/db";

import {
	type AccountPreferences,
	type AccountPreferencesInput,
	accountPreferencesInputSchema,
	dateFormatSchema,
	firstDayOfWeekSchema,
	localeSchema,
	timeZoneSchema,
	unsavedAccountPreferences,
} from "./account-preferences-model";

export async function getAccountPreferences(
	prisma: PrismaClient,
	accountId: string
): Promise<AccountPreferences> {
	const row = await prisma.accountPreference.findUnique({
		where: { accountId },
	});
	if (!row) {
		return unsavedAccountPreferences();
	}
	return {
		dateFormat: dateFormatSchema.parse(row.dateFormat),
		firstDayOfWeek: firstDayOfWeekSchema.parse(row.firstDayOfWeek),
		locale: localeSchema.parse(row.locale),
		saved: true,
		timeZone: timeZoneSchema.parse(row.timeZone),
	};
}

export async function saveAccountPreferences(
	prisma: PrismaClient,
	accountId: string,
	input: AccountPreferencesInput
): Promise<AccountPreferences> {
	const parsed = accountPreferencesInputSchema.parse(input);
	await prisma.accountPreference.upsert({
		create: {
			accountId,
			dateFormat: parsed.dateFormat,
			firstDayOfWeek: parsed.firstDayOfWeek,
			id: crypto.randomUUID(),
			locale: parsed.locale,
			timeZone: parsed.timeZone,
		},
		update: {
			dateFormat: parsed.dateFormat,
			firstDayOfWeek: parsed.firstDayOfWeek,
			locale: parsed.locale,
			timeZone: parsed.timeZone,
		},
		where: { accountId },
	});
	return { ...parsed, saved: true };
}
