import {
  type AccountPreferences,
  type AccountPreferencesAccess,
  type AccountPreferencesSnapshot,
  type Appearance,
  accountPreferencesSchema,
  appearanceSchema,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";

export interface AccountPreferencesStore {
  find: (accountId: string) => Promise<AccountPreferencesRecord | null>;
  save: (
    accountId: string,
    preferences: AccountPreferences,
  ) => Promise<AccountPreferencesRecord>;
  saveAppearance: (
    accountId: string,
    appearance: Appearance,
  ) => Promise<AccountPreferencesRecord>;
}

export interface AccountPreferencesWritableAccess
  extends AccountPreferencesAccess {
  save: (
    accountId: string,
    preferences: AccountPreferences,
  ) => Promise<AccountPreferencesSnapshot>;
  saveAppearance: (
    accountId: string,
    appearance: Appearance,
  ) => Promise<AccountPreferencesSnapshot>;
}

export interface AccountPreferencesRecord {
  preferences: AccountPreferences;
  revision: number;
  savedAt: string;
}

export function createAccountPreferences({
  store,
}: {
  store: AccountPreferencesStore;
}): AccountPreferencesWritableAccess {
  return {
    async get(accountId) {
      const stored = await store.find(accountId);
      if (!stored) {
        return {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          isSaved: false,
          revision: 0,
          savedAt: null,
        };
      }

      return {
        ...accountPreferencesSchema.parse(stored.preferences),
        isSaved: true,
        revision: stored.revision,
        savedAt: stored.savedAt,
      };
    },

    async saveAppearance(accountId, appearance) {
      const stored = await store.saveAppearance(
        accountId,
        appearanceSchema.parse(appearance),
      );

      return {
        ...accountPreferencesSchema.parse(stored.preferences),
        isSaved: true,
        revision: stored.revision,
        savedAt: stored.savedAt,
      };
    },

    async save(accountId, preferences) {
      const parsed = accountPreferencesSchema.parse(preferences);
      const stored = await store.save(accountId, parsed);

      return {
        ...accountPreferencesSchema.parse(stored.preferences),
        isSaved: true,
        revision: stored.revision,
        savedAt: stored.savedAt,
      };
    },
  };
}
