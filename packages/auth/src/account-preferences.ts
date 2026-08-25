import type { PrismaClient } from "@cantiara/db";

import {
	ACCOUNT_PREFERENCES_COPY,
	DATE_FORMAT_COPY,
	preferencesChrome,
} from "./account-preferences-copy";
import {
	calendarDay,
	displayRecord,
	formatDate,
	formatDateTime,
	formatNumber,
	instantFromCalendarDate,
	startOfWeekCalendarDate,
	weekdayHeaders,
} from "./account-preferences-format";
import {
	type AccountPreferences,
	type AccountPreferencesInput,
	accountPreferencesInputSchema,
	applySuggestedLocaleAndTimeZone,
	DATE_FORMATS,
	dateFormatSchema,
	DEFAULT_DATE_FORMAT,
	DEFAULT_FIRST_DAY_OF_WEEK,
	DEFAULT_LOCALE,
	DEFAULT_TIME_ZONE,
	FIRST_DAYS_OF_WEEK,
	firstDayOfWeekSchema,
	LOCALE_OPTIONS,
	localeSchema,
	localeSelectOptions,
	shouldShowLocaleTimeZoneSuggestion,
	type SuggestedLocaleAndTimeZone,
	timeZoneOptions,
	timeZoneSchema,
	unsavedAccountPreferences,
} from "./account-preferences-model";

export {
	ACCOUNT_PREFERENCES_COPY,
	type AccountPreferences,
	type AccountPreferencesInput,
	accountPreferencesInputSchema,
	applySuggestedLocaleAndTimeZone,
	calendarDay,
	DATE_FORMAT_COPY,
	DATE_FORMATS,
	DEFAULT_DATE_FORMAT,
	DEFAULT_FIRST_DAY_OF_WEEK,
	DEFAULT_LOCALE,
	DEFAULT_TIME_ZONE,
	displayRecord,
	FIRST_DAYS_OF_WEEK,
	formatDate,
	formatDateTime,
	formatNumber,
	instantFromCalendarDate,
	LOCALE_OPTIONS,
	localeSchema,
	localeSelectOptions,
	preferencesChrome,
	shouldShowLocaleTimeZoneSuggestion,
	startOfWeekCalendarDate,
	type SuggestedLocaleAndTimeZone,
	timeZoneOptions,
	timeZoneSchema,
	unsavedAccountPreferences,
	weekdayHeaders,
};

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
