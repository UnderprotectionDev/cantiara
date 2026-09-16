import { Button } from "@cantiara/ui/components/button";
import { createStore, useSelector } from "@tanstack/react-store";
import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect } from "react";

export type ClientConnectionState = "online" | "offline";

export interface AccountFormattingPreferences {
  locale: string;
  timeZone: string;
}

export const DEFAULT_ACCOUNT_FORMATTING_PREFERENCES = {
  locale: "en-GB",
  timeZone: "Europe/Istanbul",
} as const satisfies AccountFormattingPreferences;

export interface ClientShellState {
  connection: ClientConnectionState;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
}

export interface ClientShell {
  assertOnline: () => void;
  get: () => ClientShellState;
  getState: () => ClientShellState;
  markUnsavedChanges: (hasUnsavedChanges?: boolean) => void;
  recordSuccessfulSave: (savedAt?: Date) => void;
  request: (
    input: RequestInfo | URL,
    init?: RequestInit,
    fetcher?: typeof globalThis.fetch,
  ) => Promise<Response>;
  retryConnection: () => boolean;
  runOnlineOnly: <T>(operation: () => Promise<T>) => Promise<T>;
  runWrite: <T>(write: () => Promise<T>) => Promise<T>;
  setConnectionState: (connection: ClientConnectionState) => void;
  subscribe: (listener: (state: ClientShellState) => void) => {
    unsubscribe: () => void;
  };
}

export class ClientShellOfflineError extends Error {
  constructor() {
    super("This action requires an active internet connection.");
    this.name = "ClientShellOfflineError";
  }
}

interface CreateClientShellOptions {
  initialConnection?: ClientConnectionState;
  initialLastSavedAt?: Date | null;
  initialUnsavedChanges?: boolean;
  now?: () => Date;
}

function browserConnectionState(): ClientConnectionState {
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    return "online";
  }
  return "offline";
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError;
}

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function copyDate(value: Date | null) {
  return value ? new Date(value.getTime()) : null;
}

export function createClientShell(
  options: CreateClientShellOptions = {},
): ClientShell {
  const store = createStore<ClientShellState>({
    connection: options.initialConnection ?? browserConnectionState(),
    hasUnsavedChanges: options.initialUnsavedChanges ?? false,
    lastSavedAt: copyDate(options.initialLastSavedAt ?? null),
  });
  const now = options.now ?? (() => new Date());

  function update(next: Partial<ClientShellState>) {
    store.setState((state) => {
      const updatedState = { ...state, ...next };
      if (
        updatedState.connection === state.connection &&
        updatedState.hasUnsavedChanges === state.hasUnsavedChanges &&
        updatedState.lastSavedAt?.getTime() === state.lastSavedAt?.getTime()
      ) {
        return state;
      }

      return updatedState;
    });
  }

  function assertOnline() {
    if (store.state.connection === "offline") {
      throw new ClientShellOfflineError();
    }
  }

  function setConnectionState(connection: ClientConnectionState) {
    update({ connection });
  }

  function retryConnection() {
    if (browserIsOffline()) {
      return false;
    }

    setConnectionState("online");
    return true;
  }

  function markUnsavedChanges(hasUnsavedChanges = true) {
    update({ hasUnsavedChanges });
  }

  function recordSuccessfulSave(savedAt = now()) {
    update({
      connection: "online",
      hasUnsavedChanges: false,
      lastSavedAt: copyDate(savedAt),
    });
  }

  function recordNetworkFailure(error: unknown) {
    if (isNetworkFailure(error) && browserIsOffline()) {
      setConnectionState("offline");
    }
  }

  async function request(
    input: RequestInfo | URL,
    init?: RequestInit,
    fetcher: typeof globalThis.fetch = globalThis.fetch,
  ) {
    assertOnline();
    try {
      const response = await fetcher(input, init);
      setConnectionState("online");
      return response;
    } catch (error) {
      recordNetworkFailure(error);
      throw error;
    }
  }

  async function runOnlineOnly<T>(operation: () => Promise<T>) {
    assertOnline();
    try {
      return await operation();
    } catch (error) {
      recordNetworkFailure(error);
      throw error;
    }
  }

  async function runWrite<T>(write: () => Promise<T>) {
    const result = await runOnlineOnly(write);
    recordSuccessfulSave();
    return result;
  }

  return {
    assertOnline,
    get: () => store.state,
    getState: () => store.state,
    markUnsavedChanges,
    recordSuccessfulSave,
    request,
    retryConnection,
    runOnlineOnly,
    runWrite,
    setConnectionState,
    subscribe: (listener) => store.subscribe(listener),
  };
}

export const defaultClientShell = createClientShell();

export function formatLastSaved(
  lastSavedAt: Date | null,
  accountFormattingPreferences: AccountFormattingPreferences = DEFAULT_ACCOUNT_FORMATTING_PREFERENCES,
) {
  if (!lastSavedAt || Number.isNaN(lastSavedAt.getTime())) {
    return "Not yet";
  }

  try {
    return new Intl.DateTimeFormat(accountFormattingPreferences.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: accountFormattingPreferences.timeZone,
    }).format(lastSavedAt);
  } catch {
    return new Intl.DateTimeFormat(
      DEFAULT_ACCOUNT_FORMATTING_PREFERENCES.locale,
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: DEFAULT_ACCOUNT_FORMATTING_PREFERENCES.timeZone,
      },
    ).format(lastSavedAt);
  }
}

const ClientShellContext = createContext<ClientShell | null>(null);
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
  children: ReactNode;
  shell?: ClientShell;
}) {
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

export function useClientShell() {
  const shell = useContext(ClientShellContext);
  if (!shell) {
    throw new Error("ClientShellProvider is required.");
  }
  return shell;
}

function useClientShellState() {
  return useSelector(useClientShell());
}

export function useClientShellConnection() {
  return useClientShellState().connection;
}

function ClientShellOfflineState({
  accountFormattingPreferences,
  layout = "empty",
  onRetry,
  state,
}: {
  accountFormattingPreferences: AccountFormattingPreferences;
  layout?: "empty" | "status";
  onRetry?: () => void;
  state: ClientShellState;
}) {
  const shell = useClientShell();
  const handleRetry = useCallback(() => {
    if (shell.retryConnection()) {
      onRetry?.();
    }
  }, [onRetry, shell]);

  const status = (
    <section
      aria-labelledby="client-shell-offline-title"
      aria-live="polite"
      className="w-full max-w-2xl border-destructive border-l-2 py-2 pl-6 sm:pl-8"
      role="status"
    >
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center border border-destructive/50 bg-destructive/15 text-destructive">
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
          {state.lastSavedAt ? (
            <time dateTime={state.lastSavedAt.toISOString()}>
              {formatLastSaved(state.lastSavedAt, accountFormattingPreferences)}
            </time>
          ) : (
            "Not yet"
          )}
        </dd>
      </dl>

      {state.hasUnsavedChanges ? (
        <p className="mt-6 border border-destructive/40 bg-destructive/10 px-4 py-3 font-medium text-destructive text-sm">
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
}: {
  accountFormattingPreferences?: AccountFormattingPreferences;
  onRetry?: () => void;
} = {}) {
  const state = useClientShellState();
  const contextPreferences = useContext(AccountFormattingPreferencesContext);
  const preferences = accountFormattingPreferences ?? contextPreferences;

  if (state.connection === "online") {
    return null;
  }

  return (
    <ClientShellOfflineState
      accountFormattingPreferences={preferences}
      layout="status"
      onRetry={onRetry}
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

export function runOnlineOnlyWrite<T>(write: () => Promise<T>) {
  return defaultClientShell.runOnlineOnly(write);
}
