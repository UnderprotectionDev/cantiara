import {
  type AccountPreferencesSnapshot,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

import AccountPreferencesForm from "../forms/account-preferences-form";

export default function PreferencesView() {
  const preferences = useQuery(orpc.accountPreferences.queryOptions());

  if (preferences.isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-semibold text-2xl tracking-tight">Preferences</h1>
        <p className="mt-3 text-muted-foreground text-sm">
          Loading preferences…
        </p>
      </main>
    );
  }

  if (preferences.isError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-semibold text-2xl tracking-tight">Preferences</h1>
        <div className="mt-6 border-y py-8 text-sm" role="alert">
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
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b pb-7">
        <h1 className="font-semibold text-2xl tracking-tight">Preferences</h1>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm/6">
          Choose how Cantiara formats dates, times, numbers, weeks, and the
          product appearance across every Project.
        </p>
      </header>
      <div className="pt-7">
        <AccountPreferencesForm snapshot={snapshot} />
      </div>
    </main>
  );
}
