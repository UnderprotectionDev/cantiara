import { describe, expect, test } from "vitest";

import { getBrowserPreferenceSuggestion } from "./browser-preference-suggestion";

describe("browser preference suggestion", () => {
  test("returns browser values as a suggestion without changing product defaults", () => {
    expect(
      getBrowserPreferenceSuggestion({
        locale: "tr-TR",
        timeZone: "Europe/London",
      }),
    ).toEqual({
      locale: "tr-TR",
      timeZone: "Europe/London",
    });
  });

  test("falls back to product defaults for unsupported browser values", () => {
    expect(
      getBrowserPreferenceSuggestion({
        locale: "not_a_locale",
        timeZone: "Not/A-Time-Zone",
      }),
    ).toEqual({
      locale: "en-GB",
      timeZone: "Europe/Istanbul",
    });
  });
});
