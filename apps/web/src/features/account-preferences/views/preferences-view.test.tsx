import {
  type AccountPreferencesSnapshot,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { accountPreferencesQueryOptions } from "@/utils/orpc";

import PreferencesView from "./preferences-view";

function renderPreferences(data: AccountPreferencesSnapshot) {
  const queryClient = new QueryClient();
  const accountId = "account-1";
  queryClient.setQueryData(
    accountPreferencesQueryOptions(accountId).queryKey,
    data,
  );

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <PreferencesView accountId={accountId} />
    </QueryClientProvider>,
  );
}

describe("Preferences view", () => {
  test("uses a separate query cache entry for each Account", () => {
    expect(accountPreferencesQueryOptions("account-1").queryKey).not.toEqual(
      accountPreferencesQueryOptions("account-2").queryKey,
    );
  });

  test("shows default values and the unsaved browser suggestion in English", () => {
    const html = renderPreferences({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      savedAt: null,
    });

    expect(html).toContain(">Preferences</h1>");
    expect(html).toContain("Locale");
    expect(html).toContain("Time zone");
    expect(html).toContain("Date format");
    expect(html).toContain("First day of week");
    expect(html).toContain("Appearance");
    expect(html).toContain("Use suggested locale and time zone");
    expect(html).toContain("Before saving");
    expect(html).toContain("Example number");
    expect(html).toContain('id="account-preferences-locale"');
    expect(html).toContain('id="account-preferences-time-zone"');
    expect(html).toContain('value="en-GB"');
    expect(html).toContain('value="Europe/Istanbul"');
    expect(html).toContain('value="UTC"');
    expect(html).toContain("16 Sept 2026, 12:00");
    expect(html).toContain("1,234,567.89");
    expect(html).toContain("Mon");
    expect(html).toContain("<button");
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("System");
    expect(html).not.toContain("Language preference");
  });

  test("does not show the first-login suggestion after preferences are saved", () => {
    const html = renderPreferences({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: true,
      savedAt: "2026-09-16T09:00:00.000Z",
      locale: "tr-TR",
    });

    expect(html).not.toContain("Use suggested locale and time zone");
    expect(html).toContain("Eyl");
    expect(html).toContain("1.234.567,89");
  });
});
