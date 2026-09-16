import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { describe, expect, test } from "vitest";

import { createAccountPreferences } from "./account-preferences";

const SAVED_AT = "2026-09-16T09:00:00.000Z";

function createMemoryStore(initial?: {
  preferences: AccountPreferences;
  savedAt: string;
}) {
  let value = initial;

  return {
    find: () => Promise.resolve(value ?? null),
    save: (_accountId: string, preferences: AccountPreferences) => {
      value = { preferences, savedAt: SAVED_AT };
      return Promise.resolve(value);
    },
  };
}

describe("Account Preferences seam", () => {
  test("reads product defaults until the founder explicitly saves", async () => {
    const preferences = createAccountPreferences({
      store: createMemoryStore(),
    });

    await expect(preferences.get("account-1")).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      savedAt: null,
    });
  });

  test("saves one Account preference set and reads it across later calls", async () => {
    const preferences = createAccountPreferences({
      store: createMemoryStore(),
    });
    const saved: AccountPreferences = {
      appearance: "Light",
      dateFormat: "dd/MM/yyyy",
      firstDayOfWeek: "Sunday",
      locale: "tr-TR",
      timeZone: "Europe/London",
    };

    await expect(preferences.save("account-1", saved)).resolves.toEqual({
      ...saved,
      isSaved: true,
      savedAt: SAVED_AT,
    });
    await expect(preferences.get("account-1")).resolves.toEqual({
      ...saved,
      isSaved: true,
      savedAt: SAVED_AT,
    });
  });

  test("rejects an unsupported time zone without writing it", async () => {
    const store = createMemoryStore();
    const preferences = createAccountPreferences({ store });

    await expect(
      preferences.save("account-1", {
        ...DEFAULT_ACCOUNT_PREFERENCES,
        timeZone: "Not/A-Time-Zone",
      }),
    ).rejects.toThrow();
    await expect(preferences.get("account-1")).resolves.toEqual({
      ...DEFAULT_ACCOUNT_PREFERENCES,
      isSaved: false,
      savedAt: null,
    });
  });
});
