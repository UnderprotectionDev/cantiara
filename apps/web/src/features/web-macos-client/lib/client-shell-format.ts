export interface AccountFormattingPreferences {
  locale: string;
  timeZone: string;
}

export const DEFAULT_ACCOUNT_FORMATTING_PREFERENCES = {
  locale: "en-GB",
  timeZone: "Europe/Istanbul",
} as const satisfies AccountFormattingPreferences;

export function formatLastSaved(
  lastSavedAt: Date | null,
  accountFormattingPreferences: AccountFormattingPreferences = DEFAULT_ACCOUNT_FORMATTING_PREFERENCES,
) {
  if (!lastSavedAt || Number.isNaN(lastSavedAt.getTime())) {
    return "Not yet";
  }

  try {
    return new Intl.DateTimeFormat(accountFormattingPreferences.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: accountFormattingPreferences.timeZone,
    }).format(lastSavedAt);
  } catch {
    return new Intl.DateTimeFormat(
      DEFAULT_ACCOUNT_FORMATTING_PREFERENCES.locale,
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: DEFAULT_ACCOUNT_FORMATTING_PREFERENCES.timeZone,
      },
    ).format(lastSavedAt);
  }
}
