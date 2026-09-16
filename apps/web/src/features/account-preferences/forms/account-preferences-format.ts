import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { addDays } from "date-fns";

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(
      "Account preference formatting requires a valid date.",
    );
  }
  return date;
}

function dateParts(value: Date | string, preferences: AccountPreferences) {
  const parts = new Intl.DateTimeFormat(preferences.locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: preferences.timeZone,
    year: "numeric",
  }).formatToParts(asDate(value));

  return Object.fromEntries(
    parts
      .filter(
        ({ type }) => type === "day" || type === "month" || type === "year",
      )
      .map(({ type, value: partValue }) => [type, partValue]),
  ) as Record<"day" | "month" | "year", string>;
}

export function formatAccountDate(
  value: Date | string,
  preferences: AccountPreferences,
) {
  const date = asDate(value);
  if (preferences.dateFormat === "locale") {
    return new Intl.DateTimeFormat(preferences.locale, {
      dateStyle: "medium",
      timeZone: preferences.timeZone,
    }).format(date);
  }

  const parts = dateParts(date, preferences);
  switch (preferences.dateFormat) {
    case "dd/MM/yyyy":
      return `${parts.day}/${parts.month}/${parts.year}`;
    case "MM/dd/yyyy":
      return `${parts.month}/${parts.day}/${parts.year}`;
    case "yyyy-MM-dd":
      return `${parts.year}-${parts.month}-${parts.day}`;
    default:
      throw new RangeError("Unsupported account date format.");
  }
}

export function formatAccountDateTime(
  value: Date | string,
  preferences: AccountPreferences,
) {
  const date = asDate(value);
  if (preferences.dateFormat === "locale") {
    return new Intl.DateTimeFormat(preferences.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: preferences.timeZone,
    }).format(date);
  }

  const time = new Intl.DateTimeFormat(preferences.locale, {
    timeStyle: "short",
    timeZone: preferences.timeZone,
  }).format(date);
  return `${formatAccountDate(date, preferences)} ${time}`;
}

export function formatAccountNumber(
  value: number,
  preferences: AccountPreferences,
) {
  return new Intl.NumberFormat(preferences.locale).format(value);
}

export function getWeekDayLabels(preferences: AccountPreferences) {
  const weekStartsOn = preferences.firstDayOfWeek === "Sunday" ? 0 : 1;
  const referenceDate = new Date(Date.UTC(2026, 8, 16, 12));
  const dayOfWeek = referenceDate.getUTCDay();
  const daysSinceWeekStart = (dayOfWeek - weekStartsOn + 7) % 7;
  const weekStart = addDays(referenceDate, -daysSinceWeekStart);
  const formatter = new Intl.DateTimeFormat(preferences.locale, {
    timeZone: "UTC",
    weekday: "short",
  });

  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(weekStart, index)),
  );
}
