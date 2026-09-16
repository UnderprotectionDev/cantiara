import {
  DEFAULT_ACCOUNT_PREFERENCES,
  isSupportedLocale,
  isSupportedTimeZone,
} from "@cantiara/api/account-preferences";

export interface BrowserPreferenceSuggestion {
  locale: string;
  timeZone: string;
}

interface BrowserPreferenceEnvironment {
  locale?: string;
  timeZone?: string;
}

function browserPreferenceEnvironment(): BrowserPreferenceEnvironment {
  if (typeof navigator === "undefined") {
    return {};
  }

  let timeZone: string | undefined;
  try {
    const { timeZone: resolvedTimeZone } =
      Intl.DateTimeFormat().resolvedOptions();
    timeZone = resolvedTimeZone;
  } catch {
    timeZone = undefined;
  }

  return { locale: navigator.language, timeZone };
}

export function getBrowserPreferenceSuggestion(
  environment = browserPreferenceEnvironment(),
): BrowserPreferenceSuggestion {
  return {
    locale:
      environment.locale && isSupportedLocale(environment.locale)
        ? environment.locale
        : DEFAULT_ACCOUNT_PREFERENCES.locale,
    timeZone:
      environment.timeZone && isSupportedTimeZone(environment.timeZone)
        ? environment.timeZone
        : DEFAULT_ACCOUNT_PREFERENCES.timeZone,
  };
}
