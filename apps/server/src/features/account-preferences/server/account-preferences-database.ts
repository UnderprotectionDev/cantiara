import {
  type AccountPreferences,
  type Appearance,
  accountPreferencesSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { accountPreferences } from "@cantiara/db/schema/auth";
import { and, eq, sql } from "drizzle-orm";

import type { MutationDatabaseTargetAdapter } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  type AccountPreferencesStore,
  type AccountPreferencesWritableAccess,
  createAccountPreferences,
} from "./account-preferences";

type AccountPreferencesDatabaseRecord = typeof accountPreferences.$inferSelect;
type AccountPreferencesValueRecord = Pick<
  AccountPreferencesDatabaseRecord,
  "appearance" | "dateFormat" | "firstDayOfWeek" | "locale" | "timeZone"
>;

function preferenceValue(
  record: AccountPreferencesValueRecord,
): AccountPreferences {
  return accountPreferencesSchema.parse({
    appearance: record.appearance,
    dateFormat: record.dateFormat,
    firstDayOfWeek: record.firstDayOfWeek,
    locale: record.locale,
    timeZone: record.timeZone,
  });
}

function toTarget(record: AccountPreferencesDatabaseRecord) {
  return {
    id: record.accountId,
    revision: record.revision,
    value: preferenceValue(record),
  } satisfies MutationTarget<AccountPreferences>;
}

function defaultTarget(targetId: string): MutationTarget<AccountPreferences> {
  return {
    id: targetId,
    revision: 0,
    value: DEFAULT_ACCOUNT_PREFERENCES,
  };
}

export const accountPreferencesMutationTarget: MutationDatabaseTargetAdapter<AccountPreferences> =
  {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(accountPreferences)
        .where(eq(accountPreferences.accountId, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record ? toTarget(record) : defaultTarget(targetId);
    },

    async update(executor, input) {
      const revision = input.expectedRevision + 1;
      const [updated] = await executor
        .update(accountPreferences)
        .set({
          appearance: input.nextValue.appearance,
          dateFormat: input.nextValue.dateFormat,
          firstDayOfWeek: input.nextValue.firstDayOfWeek,
          locale: input.nextValue.locale,
          revision,
          timeZone: input.nextValue.timeZone,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(accountPreferences.accountId, input.targetId),
            eq(accountPreferences.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        return toTarget(updated);
      }

      const [inserted] = await executor
        .insert(accountPreferences)
        .values({
          accountId: input.targetId,
          appearance: input.nextValue.appearance,
          dateFormat: input.nextValue.dateFormat,
          firstDayOfWeek: input.nextValue.firstDayOfWeek,
          locale: input.nextValue.locale,
          revision,
          timeZone: input.nextValue.timeZone,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      return inserted ? toTarget(inserted) : null;
    },
  };

export function createDatabaseAccountPreferences(
  database: Database,
): AccountPreferencesWritableAccess {
  function savedRecord(
    preferences: Pick<
      AccountPreferencesDatabaseRecord,
      | "appearance"
      | "dateFormat"
      | "firstDayOfWeek"
      | "locale"
      | "revision"
      | "timeZone"
      | "updatedAt"
    >,
  ) {
    return {
      preferences: preferenceValue(preferences),
      revision: preferences.revision,
      savedAt: preferences.updatedAt.toISOString(),
    };
  }

  const store: AccountPreferencesStore = {
    async find(accountId) {
      const preferences = await database.query.accountPreferences.findFirst({
        columns: {
          appearance: true,
          dateFormat: true,
          firstDayOfWeek: true,
          locale: true,
          revision: true,
          timeZone: true,
          updatedAt: true,
        },
        where: eq(accountPreferences.accountId, accountId),
      });

      return preferences ? savedRecord(preferences) : null;
    },

    async saveAppearance(accountId, appearance: Appearance) {
      const [saved] = await database
        .insert(accountPreferences)
        .values({ accountId, appearance, revision: 1 })
        .onConflictDoUpdate({
          target: accountPreferences.accountId,
          set: {
            appearance,
            revision: sql`${accountPreferences.revision} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({
          appearance: accountPreferences.appearance,
          dateFormat: accountPreferences.dateFormat,
          firstDayOfWeek: accountPreferences.firstDayOfWeek,
          locale: accountPreferences.locale,
          revision: accountPreferences.revision,
          timeZone: accountPreferences.timeZone,
          updatedAt: accountPreferences.updatedAt,
        });

      if (!saved) {
        throw new Error("Account appearance could not be saved.");
      }

      return savedRecord(saved);
    },

    async save(accountId, preferences) {
      const [saved] = await database
        .insert(accountPreferences)
        .values({ accountId, ...preferences, revision: 1 })
        .onConflictDoUpdate({
          target: accountPreferences.accountId,
          set: {
            appearance: preferences.appearance,
            dateFormat: preferences.dateFormat,
            firstDayOfWeek: preferences.firstDayOfWeek,
            locale: preferences.locale,
            revision: sql`${accountPreferences.revision} + 1`,
            timeZone: preferences.timeZone,
            updatedAt: new Date(),
          },
        })
        .returning({
          appearance: accountPreferences.appearance,
          dateFormat: accountPreferences.dateFormat,
          firstDayOfWeek: accountPreferences.firstDayOfWeek,
          locale: accountPreferences.locale,
          revision: accountPreferences.revision,
          timeZone: accountPreferences.timeZone,
          updatedAt: accountPreferences.updatedAt,
        });

      if (!saved) {
        throw new Error("Account preferences could not be saved.");
      }

      return savedRecord(saved);
    },
  };

  return createAccountPreferences({ store });
}
