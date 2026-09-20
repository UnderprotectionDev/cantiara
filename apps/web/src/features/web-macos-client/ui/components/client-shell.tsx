import { Button } from "@cantiara/ui/components/button";
import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect } from "react";
import {
  ClientShellContext,
  useClientShell,
  useClientShellState,
} from "../../hooks/use-client-shell";
import {
  type AccountFormattingPreferences,
  DEFAULT_ACCOUNT_FORMATTING_PREFERENCES,
  formatLastSaved,
} from "../../lib/client-shell-format";
import { applyTauriUpdate } from "../../lib/updater";
import {
  type ClientShell,
  type ClientShellState,
  defaultClientShell,
} from "../../store/client-shell";

const AccountFormattingPreferencesContext =
  createContext<AccountFormattingPreferences>(
    DEFAULT_ACCOUNT_FORMATTING_PREFERENCES,
  );

export function ClientShellProvider({
  accountFormattingPreferences = DEFAULT_ACCOUNT_FORMATTING_PREFERENCES,
  children,
  shell = defaultClientShell,
}: {
  accountFormattingPreferences?: AccountFormattingPreferences;
  children?: ReactNode;
  shell?: ClientShell;
}) {
  useEffect(() => {
    applyTauriUpdate().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const setOnline = () => shell.setConnectionState("online");
    const setOffline = () => shell.setConnectionState("offline");

    if (navigator.onLine) {
      setOnline();
    } else {
      setOffline();
    }
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, [shell]);

  return (
    <ClientShellContext.Provider value={shell}>
      <AccountFormattingPreferencesContext.Provider
        value={accountFormattingPreferences}
      >
        {children}
      </AccountFormattingPreferencesContext.Provider>
    </ClientShellContext.Provider>
  );
}

function ClientShellOfflineState({
  accountFormattingPreferences,
  layout = "empty",
  onRetry,
  presentation = "banner",
  state,
}: {
  accountFormattingPreferences: AccountFormattingPreferences;
  layout?: "empty" | "status";
  onRetry?: () => void;
  presentation?: "banner" | "inline";
  state: ClientShellState;
}) {
  const shell = useClientShell();
  const handleRetry = useCallback(() => {
    if (shell.retryConnection()) {
      onRetry?.();
    }
  }, [onRetry, shell]);

  const lastSavedValue = state.lastSavedAt ? (
    <time dateTime={state.lastSavedAt.toISOString()}>
      {formatLastSaved(state.lastSavedAt, accountFormattingPreferences)}
    </time>
  ) : (
    "Not yet"
  );

  const inlineStatus = (
    <section
      aria-labelledby="client-shell-offline-title"
      aria-live="polite"
      className="rounded-md border border-destructive/35 bg-destructive/5 p-3"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-destructive/35 bg-destructive/15 text-destructive">
          <WifiOff aria-hidden="true" className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className="font-medium text-foreground text-sm"
              id="client-shell-offline-title"
            >
              You’re offline
            </p>
            <Button
              onClick={handleRetry}
              size="xs"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground text-xs/relaxed">
            Cantiara needs an active internet connection to read and save
            changes.
          </p>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-foreground/20 border-t pt-3 text-xs">
        <dt className="font-medium text-foreground/70">Last saved</dt>
        <dd className="font-semibold text-foreground">{lastSavedValue}</dd>
      </dl>

      {state.hasUnsavedChanges ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-medium text-destructive text-xs">
          Unsaved changes may be lost
        </p>
      ) : null}
    </section>
  );

  const status = (
    <section
      aria-labelledby="client-shell-offline-title"
      aria-live="polite"
      className="w-full max-w-2xl rounded-lg border border-destructive/35 bg-destructive/5 p-5 shadow-sm"
      role="status"
    >
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-destructive/35 bg-destructive/15 text-destructive">
          <WifiOff aria-hidden="true" className="size-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1
            className="font-semibold text-3xl text-foreground tracking-tight"
            id="client-shell-offline-title"
          >
            You’re offline
          </h1>
          <p className="mt-3 max-w-prose text-base/7 text-foreground/75">
            Cantiara needs an active internet connection to read and save
            changes.
          </p>
        </div>
      </div>

      <dl className="mt-8 grid max-w-xl grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 border-foreground/20 border-t pt-5 sm:grid-cols-[9rem_1fr] sm:gap-x-8">
        <dt className="font-medium text-base text-foreground/70">Last saved</dt>
        <dd className="font-semibold text-base text-foreground">
          {lastSavedValue}
        </dd>
      </dl>

      {state.hasUnsavedChanges ? (
        <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-medium text-destructive text-sm">
          Unsaved changes may be lost
        </p>
      ) : null}

      <div className="mt-6">
        <Button onClick={handleRetry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    </section>
  );

  const renderedStatus = presentation === "inline" ? inlineStatus : status;

  if (layout === "status") {
    return renderedStatus;
  }

  return (
    <main className="flex h-full min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-5 py-10 sm:px-8">
      {renderedStatus}
    </main>
  );
}

function ClientShellUpdateRequiredState({
  layout = "empty",
}: {
  layout?: "empty" | "status";
}) {
  const status = (
    <section
      aria-labelledby="client-shell-update-required-title"
      aria-live="assertive"
      className="w-full max-w-2xl rounded-lg border border-destructive/35 bg-destructive/5 p-5 shadow-sm"
      role="status"
    >
      <h1
        className="font-semibold text-3xl text-foreground tracking-tight"
        id="client-shell-update-required-title"
      >
        Update required
      </h1>
      <p className="mt-3 max-w-prose text-base/7 text-foreground/75">
        This desktop version must be updated before you can save changes.
      </p>
    </section>
  );

  if (layout === "status") {
    return status;
  }

  return (
    <main className="flex h-full min-h-0 flex-1 items-center justify-center overflow-auto bg-background px-5 py-10 sm:px-8">
      {status}
    </main>
  );
}

export function ClientShellStatus({
  accountFormattingPreferences,
  onRetry,
  presentation = "banner",
}: {
  accountFormattingPreferences?: AccountFormattingPreferences;
  onRetry?: () => void;
  presentation?: "banner" | "inline";
} = {}) {
  const state = useClientShellState();
  const contextPreferences = useContext(AccountFormattingPreferencesContext);
  const preferences = accountFormattingPreferences ?? contextPreferences;

  if (state.updateRequired) {
    return <ClientShellUpdateRequiredState layout="status" />;
  }

  if (state.connection === "online") {
    return null;
  }

  return (
    <ClientShellOfflineState
      accountFormattingPreferences={preferences}
      layout="status"
      onRetry={onRetry}
      presentation={presentation}
      state={state}
    />
  );
}

export function ClientShellContent({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  const state = useClientShellState();
  const preferences = useContext(AccountFormattingPreferencesContext);

  if (state.updateRequired) {
    return <ClientShellUpdateRequiredState />;
  }

  if (state.connection === "offline") {
    return (
      <ClientShellOfflineState
        accountFormattingPreferences={preferences}
        onRetry={onRetry}
        state={state}
      />
    );
  }

  return children;
}
