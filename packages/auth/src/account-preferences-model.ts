import { z } from "zod";

export const DEFAULT_LOCALE = "en-GB";
export const DEFAULT_TIME_ZONE = "Europe/Istanbul";
export const DEFAULT_FIRST_DAY_OF_WEEK = "Monday";
export const DEFAULT_DATE_FORMAT = "locale";
export const DEFAULT_APPEARANCE = "Dark";

export const APPEARANCES = ["Light", "Dark"] as const;

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

export type FirstDayOfWeek = (typeof FIRST_DAYS_OF_WEEK)[number];
export type DateFormat = (typeof DATE_FORMATS)[number];
export type Appearance = (typeof APPEARANCES)[number];

export const firstDayOfWeekSchema = z.enum(FIRST_DAYS_OF_WEEK);
export const dateFormatSchema = z.enum(DATE_FORMATS);
export const appearanceSchema = z.enum(APPEARANCES);

export const localeSchema = z
	.string()
	.min(1)
	.refine(
		(locale) => Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0,
		{ message: "Invalid locale" }
	);

export const timeZoneSchema = z
	.string()
	.min(1)
	.refine(
		(timeZone) => {
			try {
				new Intl.DateTimeFormat("en-US", { timeZone }).format();
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Invalid time zone" }
	);

export const accountPreferencesInputSchema = z.object({
	appearance: appearanceSchema,
	dateFormat: dateFormatSchema,
	firstDayOfWeek: firstDayOfWeekSchema,
	locale: localeSchema,
	timeZone: timeZoneSchema,
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

export function unsavedAccountPreferences(): AccountPreferences {
	return {
		appearance: DEFAULT_APPEARANCE,
		dateFormat: DEFAULT_DATE_FORMAT,
		firstDayOfWeek: DEFAULT_FIRST_DAY_OF_WEEK,
		locale: DEFAULT_LOCALE,
		saved: false,
		timeZone: DEFAULT_TIME_ZONE,
	};
}

export function appearanceFromHesap(
	preferences: Pick<AccountPreferences, "appearance">,
	_deviceTheme?: string
): Appearance {
	return appearanceSchema.parse(preferences.appearance);
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
