import {
  type CompletionEffectsPreferencesSnapshot,
  DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
} from "@cantiara/api/completion-effects";
import { useQuery } from "@tanstack/react-query";

import { completionEffectsPreferencesQueryOptions } from "@/utils/orpc";

import CompletionEffectsForm from "../forms/completion-effects-form";

export default function CompletionEffectsView({
  accountId,
}: {
  accountId: string;
}) {
  const preferences = useQuery(
    completionEffectsPreferencesQueryOptions(accountId),
  );

  if (preferences.isPending) {
    return (
      <main className="surface-frame max-w-6xl">
        <h1 className="font-semibold text-3xl tracking-tight">
          Completion effects
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          Loading completion effects…
        </p>
      </main>
    );
  }

  if (preferences.isError) {
    return (
      <main className="surface-frame max-w-6xl">
        <h1 className="font-semibold text-3xl tracking-tight">
          Completion effects
        </h1>
        <div
          className="mt-8 border-y bg-destructive/5 px-4 py-6 text-sm"
          role="alert"
        >
          <p className="font-medium">Completion effects are unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      </main>
    );
  }

  const snapshot: CompletionEffectsPreferencesSnapshot = preferences.data ?? {
    ...DEFAULT_COMPLETION_EFFECTS_PREFERENCES,
    isSaved: false,
    revision: 0,
    savedAt: null,
  };

  return (
    <main className="surface-frame max-w-6xl">
      <header className="surface-header max-w-3xl">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
          Account · Experimental
        </p>
        <h1 className="mt-3 text-balance font-semibold text-3xl tracking-tight">
          Completion effects
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground text-sm/6">
          Choose a quiet, original celebration for Work you complete. Your
          selection applies across every Project.
        </p>
      </header>
      <div className="pt-8">
        <CompletionEffectsForm
          accountId={accountId}
          key={accountId}
          snapshot={snapshot}
        />
      </div>
    </main>
  );
}
