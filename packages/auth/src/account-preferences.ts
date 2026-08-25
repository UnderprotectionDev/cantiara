import type { PrismaClient } from "@cantiara/db";
import { z } from "zod";

export const DEFAULT_LOCALE = "en-GB";
export const DEFAULT_TIME_ZONE = "Europe/Istanbul";
export const DEFAULT_FIRST_DAY_OF_WEEK = "Monday";
export const DEFAULT_DATE_FORMAT = "locale";

export const FIRST_DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export const DATE_FORMATS = [
	"locale",
	"dd/MM/yyyy",
	"MM/dd/yyyy",
	"yyyy-MM-dd",
] as const;

export const LOCALE_OPTIONS = [
	"en-GB",
	"en-US",
	"en-AU",
	"en-CA",
	"tr-TR",
	"de-DE",
	"fr-FR",
	"nl-NL",
	"es-ES",
	"it-IT",
	"pt-PT",
	"pt-BR",
	"sv-SE",
	"pl-PL",
	"ja-JP",
	"ko-KR",
	"zh-CN",
] as const;

export const ACCOUNT_PREFERENCES_COPY = {
	dateFormat: "Date format",
	firstDayOfWeek: "First day of week",
	heading: "Preferences",
	locale: "Locale",
	save: "Save",
	timeZone: "Time zone",
	useSuggested: "Use suggested locale and time zone",
} as const;

export const DATE_FORMAT_COPY = {
	"dd/MM/yyyy": "dd/MM/yyyy",
	locale: "Locale default",
	"MM/dd/yyyy": "MM/dd/yyyy",
	"yyyy-MM-dd": "yyyy-MM-dd",
} as const;

export type FirstDayOfWeek = (typeof FIRST_DAYS_OF_WEEK)[number];
export type DateFormat = (typeof DATE_FORMATS)[number];

export const firstDayOfWeekSchema = z.enum(FIRST_DAYS_OF_WEEK);
export const dateFormatSchema = z.enum(DATE_FORMATS);

export const accountPreferencesInputSchema = z.object({
	dateFormat: dateFormatSchema,
	firstDayOfWeek: firstDayOfWeekSchema,
	locale: z.string().min(1),
	timeZone: z.string().min(1),
});

export type AccountPreferencesInput = z.infer<
	typeof accountPreferencesInputSchema
>;

export interface AccountPreferences extends AccountPreferencesInput {
	saved: boolean;
}

export interface SuggestedLocaleAndTimeZone {
	locale: string;
	timeZone: string;
}

interface ZonedParts {
	day: number;
	hour: number;
	minute: number;
	month: number;
	second: number;
	weekday: FirstDayOfWeek;
	year: number;
}

const PADDED = 2;

export function unsavedAccountPreferences(): AccountPreferences {
	return {
		dateFormat: DEFAULT_DATE_FORMAT,
		firstDayOfWeek: DEFAULT_FIRST_DAY_OF_WEEK,
		locale: DEFAULT_LOCALE,
		saved: false,
		timeZone: DEFAULT_TIME_ZONE,
	};
}

export function preferencesChrome(_locale: string) {
	return ACCOUNT_PREFERENCES_COPY;
}

export function shouldShowLocaleTimeZoneSuggestion(
	preferences: AccountPreferences
): boolean {
	return !preferences.saved;
}

export function applySuggestedLocaleAndTimeZone(
	current: AccountPreferences,
	suggestion: SuggestedLocaleAndTimeZone
): AccountPreferences {
	return {
		...current,
		locale: suggestion.locale,
		saved: false,
		timeZone: suggestion.timeZone,
	};
}

export function localeSelectOptions(
	current: string,
	suggested?: string
): string[] {
	const options = new Set<string>(LOCALE_OPTIONS);
	options.add(current);
	if (suggested) {
		options.add(suggested);
	}
	return [...options];
}

export function timeZoneOptions(): string[] {
	return Intl.supportedValuesOf("timeZone");
}

export function weekStartsOn(
	firstDayOfWeek: FirstDayOfWeek
): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
	return FIRST_DAYS_OF_WEEK.indexOf(firstDayOfWeek) as
		| 0
		| 1
		| 2
		| 3
		| 4
		| 5
		| 6;
}

export function weekdayHeaders(
	preferences: Pick<AccountPreferences, "firstDayOfWeek">
): FirstDayOfWeek[] {
	const start = weekStartsOn(preferences.firstDayOfWeek);
	return FIRST_DAYS_OF_WEEK.map((_, index) => {
		const day = FIRST_DAYS_OF_WEEK[(start + index) % FIRST_DAYS_OF_WEEK.length];
		if (!day) {
			throw new Error("Invalid first day of week");
		}
		return day;
	});
}

export function formatDate(
	instant: Date,
	preferences: AccountPreferencesInput
): string {
	if (preferences.dateFormat === "locale") {
		return new Intl.DateTimeFormat(preferences.locale, {
			day: "2-digit",
			month: "2-digit",
			timeZone: preferences.timeZone,
			year: "numeric",
		}).format(instant);
	}
	const parts = zonedParts(instant, preferences.timeZone);
	const day = String(parts.day).padStart(PADDED, "0");
	const month = String(parts.month).padStart(PADDED, "0");
	const year = String(parts.year);
	if (preferences.dateFormat === "MM/dd/yyyy") {
		return `${month}/${day}/${year}`;
	}
	if (preferences.dateFormat === "yyyy-MM-dd") {
		return `${year}-${month}-${day}`;
	}
	return `${day}/${month}/${year}`;
}

export function formatDateTime(
	instant: Date,
	preferences: AccountPreferencesInput
): string {
	if (preferences.dateFormat === "locale") {
		return new Intl.DateTimeFormat(preferences.locale, {
			day: "2-digit",
			hour: "2-digit",
			hourCycle: "h23",
			minute: "2-digit",
			month: "2-digit",
			timeZone: preferences.timeZone,
			year: "numeric",
		}).format(instant);
	}
	const time = new Intl.DateTimeFormat(preferences.locale, {
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		timeZone: preferences.timeZone,
	}).format(instant);
	return `${formatDate(instant, preferences)}, ${time}`;
}

export function formatNumber(
	value: number,
	preferences: Pick<AccountPreferencesInput, "locale">
): string {
	return new Intl.NumberFormat(preferences.locale).format(value);
}

export function calendarDay(
	instant: Date,
	preferences: Pick<AccountPreferencesInput, "timeZone">
): string {
	const parts = zonedParts(instant, preferences.timeZone);
	return `${parts.year}-${String(parts.month).padStart(PADDED, "0")}-${String(parts.day).padStart(PADDED, "0")}`;
}

export function startOfWeekCalendarDate(
	instant: Date,
	preferences: Pick<AccountPreferencesInput, "firstDayOfWeek" | "timeZone">
): string {
	const parts = zonedParts(instant, preferences.timeZone);
	const weekday = weekStartsOn(parts.weekday);
	const start = weekStartsOn(preferences.firstDayOfWeek);
	const delta =
		(weekday - start + FIRST_DAYS_OF_WEEK.length) % FIRST_DAYS_OF_WEEK.length;
	const startDate = addCalendarDays(parts.year, parts.month, parts.day, -delta);
	return `${startDate.year}-${String(startDate.month).padStart(PADDED, "0")}-${String(startDate.day).padStart(PADDED, "0")}`;
}

export function instantFromCalendarDate(
	isoDate: string,
	preferences: Pick<AccountPreferencesInput, "timeZone">
): Date {
	const [year, month, day] = isoDate.split("-").map(Number);
	if (year === undefined || month === undefined || day === undefined) {
		throw new Error("Invalid calendar date");
	}
	return instantFromZoned(year, month, day, 0, 0, preferences.timeZone);
}

export function displayRecord(
	record: {
		key: string;
		occurredAt: Date;
		status: string;
		title: string;
	},
	preferences: AccountPreferencesInput
) {
	return {
		key: record.key,
		occurredAt: record.occurredAt.toISOString(),
		occurredAtDisplay: formatDateTime(record.occurredAt, preferences),
		status: record.status,
		title: record.title,
	};
}

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
		locale: row.locale,
		saved: true,
		timeZone: row.timeZone,
	};
}

export async function saveAccountPreferences(
	prisma: PrismaClient,
	accountId: string,
	input: AccountPreferencesInput
): Promise<AccountPreferences> {
	const parsed = accountPreferencesInputSchema.parse(input);
	assertSupportedLocale(parsed.locale);
	assertSupportedTimeZone(parsed.timeZone);
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

function assertSupportedLocale(locale: string) {
	if (Intl.DateTimeFormat.supportedLocalesOf([locale]).length === 0) {
		throw new Error("Invalid locale");
	}
}

function assertSupportedTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format();
	} catch (error) {
		throw new Error("Invalid time zone", { cause: error });
	}
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		weekday: "long",
		year: "numeric",
	}).formatToParts(instant);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;
	const weekday = firstDayOfWeekSchema.parse(value("weekday"));
	return {
		day: Number(value("day")),
		hour: Number(value("hour")),
		minute: Number(value("minute")),
		month: Number(value("month")),
		second: Number(value("second")),
		weekday,
		year: Number(value("year")),
	};
}

function addCalendarDays(
	year: number,
	month: number,
	day: number,
	delta: number
) {
	const utc = new Date(Date.UTC(year, month - 1, day + delta));
	return {
		day: utc.getUTCDate(),
		month: utc.getUTCMonth() + 1,
		year: utc.getUTCFullYear(),
	};
}

function instantFromZoned(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	timeZone: string
): Date {
	const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
	const parts = zonedParts(new Date(utcGuess), timeZone);
	const asUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	);
	const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
	return new Date(utcGuess + (desired - asUtc));
}
