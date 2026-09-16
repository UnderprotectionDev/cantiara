import {
  type AccountPreferencesSnapshot,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { useQuery } from "@tanstack/react-query";

import { accountPreferencesQueryOptions } from "@/utils/orpc";

import AccountPreferencesForm from "../forms/account-preferences-form";

export default function PreferencesView({ accountId }: { accountId: string }) {
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));

  if (preferences.isPending) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-semibold text-3xl tracking-tight">Preferences</h1>
        <p className="mt-3 text-muted-foreground text-sm">
          Loading preferences…
        </p>
      </main>
    );
  }

  if (preferences.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-semibold text-3xl tracking-tight">Preferences</h1>
        <div
          className="mt-8 border-y bg-destructive/5 px-4 py-6 text-sm"
          role="alert"
        >
          <p className="font-medium">Preferences are unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      </main>
    );
  }

  const snapshot: AccountPreferencesSnapshot = preferences.data ?? {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    isSaved: false,
    savedAt: null,
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-2xl border-b pb-8">
        <h1 className="text-balance font-semibold text-3xl tracking-tight">
          Preferences
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground text-sm/6">
          Choose how Cantiara formats dates, times, numbers, weeks, and the
          product appearance across every Project.
        </p>
      </header>
      <div className="pt-8">
        <AccountPreferencesForm
          accountId={accountId}
          key={accountId}
          snapshot={snapshot}
        />
      </div>
    </main>
  );
}
