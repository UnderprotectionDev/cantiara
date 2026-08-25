import {
	type AccountPreferences,
	type AccountPreferencesInput,
	FIRST_DAYS_OF_WEEK,
	type FirstDayOfWeek,
	firstDayOfWeekSchema,
} from "./account-preferences-model";

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

function weekStartsOn(
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
			minute: "2-digit",
			month: "2-digit",
			timeZone: preferences.timeZone,
			year: "numeric",
		}).format(instant);
	}
	const time = new Intl.DateTimeFormat(preferences.locale, {
		hour: "2-digit",
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
