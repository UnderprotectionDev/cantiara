import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { describe, expect, test } from "vitest";

import {
  formatAccountDate,
  formatAccountDateTime,
  formatAccountNumber,
  getWeekDayLabels,
} from "./account-preferences-format";

describe("Account Preferences formatting", () => {
  test("formats a timestamp and number with the product defaults", () => {
    expect(
      formatAccountDateTime(
        "2026-09-16T09:00:00.000Z",
        DEFAULT_ACCOUNT_PREFERENCES,
      ),
    ).toBe("16 Sept 2026, 12:00");
    expect(formatAccountNumber(1_234_567.89, DEFAULT_ACCOUNT_PREFERENCES)).toBe(
      "1,234,567.89",
    );
  });

  test("uses a saved locale without translating product content", () => {
    const preferences: AccountPreferences = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      locale: "tr-TR",
    };

    expect(
      formatAccountDate("2026-09-16T09:00:00.000Z", preferences),
    ).toContain("Eyl");
    expect(formatAccountNumber(1_234_567.89, preferences)).toBe("1.234.567,89");
  });

  test("uses a custom date format and the saved time zone for the same instant", () => {
    const preferences: AccountPreferences = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      dateFormat: "yyyy-MM-dd",
      timeZone: "America/Los_Angeles",
    };

    expect(formatAccountDateTime("2026-09-17T06:30:00.000Z", preferences)).toBe(
      "2026-09-16 23:30",
    );
  });

  test("keeps date-only values on their calendar date in every time zone", () => {
    const preferences: AccountPreferences = {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      dateFormat: "yyyy-MM-dd",
      timeZone: "Pacific/Kiritimati",
    };

    expect(formatAccountDate("2026-09-30", preferences)).toBe("2026-09-30");
  });

  test("moves the week grid's first label without changing the instant", () => {
    const monday = getWeekDayLabels({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      firstDayOfWeek: "Monday",
    });
    const sunday = getWeekDayLabels({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      firstDayOfWeek: "Sunday",
    });

    expect(monday[0]).toBe("Mon");
    expect(sunday[0]).toBe("Sun");
    expect(monday).toHaveLength(7);
    expect(sunday).toHaveLength(7);
  });
});
