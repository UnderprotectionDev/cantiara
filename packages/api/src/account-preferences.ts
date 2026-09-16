import { z } from "zod";

export const DEFAULT_ACCOUNT_PREFERENCES = {
  appearance: "Dark",
  dateFormat: "locale",
  firstDayOfWeek: "Monday",
  locale: "en-GB",
  timeZone: "Europe/Istanbul",
} as const;

export const DATE_FORMAT_OPTIONS = [
  { label: "Locale default", value: "locale" },
  { label: "31/12/2026", value: "dd/MM/yyyy" },
  { label: "12/31/2026", value: "MM/dd/yyyy" },
  { label: "2026-12-31", value: "yyyy-MM-dd" },
] as const;

export const FIRST_DAY_OF_WEEK_OPTIONS = ["Monday", "Sunday"] as const;
export const APPEARANCE_OPTIONS = ["Light", "Dark"] as const;

export type DateFormat = (typeof DATE_FORMAT_OPTIONS)[number]["value"];
export type FirstDayOfWeek = (typeof FIRST_DAY_OF_WEEK_OPTIONS)[number];
export type Appearance = (typeof APPEARANCE_OPTIONS)[number];

export function isSupportedLocale(locale: string) {
  try {
    const [canonicalLocale] = Intl.getCanonicalLocales(locale);
    if (!canonicalLocale) {
      return false;
    }
    new Intl.DateTimeFormat(canonicalLocale).format();
    return true;
  } catch {
    return false;
  }
}

export function isSupportedTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export const accountPreferencesSchema = z.object({
  appearance: z.enum(APPEARANCE_OPTIONS),
  dateFormat: z.enum(
    DATE_FORMAT_OPTIONS.map(({ value }) => value) as [
      DateFormat,
      ...DateFormat[],
    ],
  ),
  firstDayOfWeek: z.enum(FIRST_DAY_OF_WEEK_OPTIONS),
  locale: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine(isSupportedLocale, "Locale must be a supported locale."),
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(
      isSupportedTimeZone,
      "Time zone must be a supported IANA time zone.",
    ),
});

export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;

export interface AccountPreferencesSnapshot extends AccountPreferences {
  isSaved: boolean;
  savedAt: string | null;
}

export interface AccountPreferencesAccess {
  get: (accountId: string) => Promise<AccountPreferencesSnapshot>;
  save: (
    accountId: string,
    preferences: AccountPreferences,
  ) => Promise<AccountPreferencesSnapshot>;
}
