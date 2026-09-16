import {
  type AccountPreferencesAccess,
  accountPreferencesSchema,
} from "@cantiara/api/account-preferences";
import type { Database } from "@cantiara/db";
import { accountPreferences } from "@cantiara/db/schema/auth";
import { eq } from "drizzle-orm";

import {
  type AccountPreferencesStore,
  createAccountPreferences,
} from "./account-preferences";

export function createDatabaseAccountPreferences(
  database: Database,
): AccountPreferencesAccess {
  const store: AccountPreferencesStore = {
    async find(accountId) {
      const preferences = await database.query.accountPreferences.findFirst({
        columns: {
          appearance: true,
          dateFormat: true,
          firstDayOfWeek: true,
          locale: true,
          timeZone: true,
          updatedAt: true,
        },
        where: eq(accountPreferences.accountId, accountId),
      });

      return preferences
        ? {
            preferences: accountPreferencesSchema.parse(preferences),
            savedAt: preferences.updatedAt.toISOString(),
          }
        : null;
    },

    async save(accountId, preferences) {
      const [saved] = await database
        .insert(accountPreferences)
        .values({ accountId, ...preferences })
        .onConflictDoUpdate({
          target: accountPreferences.accountId,
          set: {
            appearance: preferences.appearance,
            dateFormat: preferences.dateFormat,
            firstDayOfWeek: preferences.firstDayOfWeek,
            locale: preferences.locale,
            timeZone: preferences.timeZone,
            updatedAt: new Date(),
          },
        })
        .returning({
          appearance: accountPreferences.appearance,
          dateFormat: accountPreferences.dateFormat,
          firstDayOfWeek: accountPreferences.firstDayOfWeek,
          locale: accountPreferences.locale,
          timeZone: accountPreferences.timeZone,
          updatedAt: accountPreferences.updatedAt,
        });

      if (!saved) {
        throw new Error("Account preferences could not be saved.");
      }

      return {
        preferences: accountPreferencesSchema.parse(saved),
        savedAt: saved.updatedAt.toISOString(),
      };
    },
  };

  return createAccountPreferences({ store });
}
