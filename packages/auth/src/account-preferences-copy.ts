export const ACCOUNT_PREFERENCES_COPY = {
	appearance: "Appearance",
	dark: "Dark",
	date: "Date",
	dateFormat: "Date format",
	firstDayOfWeek: "First day of week",
	heading: "Preferences",
	historicalEvent: "Historical event",
	light: "Light",
	loading: "Loading preferences…",
	locale: "Locale",
	number: "Number",
	preview: "Preview",
	save: "Save",
	saved: "Preferences saved.",
	timeZone: "Time zone",
	unavailable: "Preferences are unavailable.",
	useSuggested: "Use suggested locale and time zone",
	week: "Week",
	workTitle: "Work title",
} as const;

export const DATE_FORMAT_COPY = {
	"dd/MM/yyyy": "dd/MM/yyyy",
	locale: "Locale default",
	"MM/dd/yyyy": "MM/dd/yyyy",
	"yyyy-MM-dd": "yyyy-MM-dd",
} as const;

export function preferencesChrome(_locale: string) {
	return ACCOUNT_PREFERENCES_COPY;
}
