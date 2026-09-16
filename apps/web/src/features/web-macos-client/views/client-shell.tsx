import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

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
  getState: () => ClientShellState;
  markUnsavedChanges: (hasUnsavedChanges?: boolean) => void;
  recordSuccessfulSave: (savedAt?: Date) => void;
  request: (
    input: RequestInfo | URL,
    init?: RequestInit,
    fetcher?: typeof globalThis.fetch,
  ) => Promise<Response>;
  runWrite: <T>(write: () => Promise<T>) => Promise<T>;
  setConnectionState: (connection: ClientConnectionState) => void;
  subscribe: (listener: () => void) => () => void;
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
  if (typeof navigator === "undefined" || navigator.onLine) {
    return "online";
  }
  return "offline";
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError;
}

function copyDate(value: Date | null) {
  return value ? new Date(value.getTime()) : null;
}

export function createClientShell(
  options: CreateClientShellOptions = {},
): ClientShell {
  let state: ClientShellState = {
    connection: options.initialConnection ?? browserConnectionState(),
    hasUnsavedChanges: options.initialUnsavedChanges ?? false,
    lastSavedAt: copyDate(options.initialLastSavedAt ?? null),
  };
  const listeners = new Set<() => void>();
  const now = options.now ?? (() => new Date());

  function update(next: Partial<ClientShellState>) {
    const updatedState = { ...state, ...next };
    if (
      updatedState.connection === state.connection &&
      updatedState.hasUnsavedChanges === state.hasUnsavedChanges &&
      updatedState.lastSavedAt?.getTime() === state.lastSavedAt?.getTime()
    ) {
      return;
    }

    state = updatedState;
    for (const listener of listeners) {
      listener();
    }
  }

  function assertOnline() {
    if (state.connection === "offline") {
      throw new ClientShellOfflineError();
    }
  }

  function setConnectionState(connection: ClientConnectionState) {
    update({ connection });
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
      if (isNetworkFailure(error)) {
        setConnectionState("offline");
      }
      throw error;
    }
  }

  async function runWrite<T>(write: () => Promise<T>) {
    assertOnline();
    try {
      const result = await write();
      recordSuccessfulSave();
      return result;
    } catch (error) {
      if (isNetworkFailure(error)) {
        setConnectionState("offline");
      }
      throw error;
    }
  }

  return {
    assertOnline,
    getState: () => state,
    markUnsavedChanges,
    recordSuccessfulSave,
    request,
    runWrite,
    setConnectionState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
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
  const shell = useClientShell();
  return useSyncExternalStore(shell.subscribe, shell.getState, shell.getState);
}

export function ClientShellStatus({
  accountFormattingPreferences,
}: {
  accountFormattingPreferences?: AccountFormattingPreferences;
} = {}) {
  const state = useClientShellState();
  const contextPreferences = useContext(AccountFormattingPreferencesContext);
  const preferences = accountFormattingPreferences ?? contextPreferences;

  if (state.connection === "online") {
    return null;
  }

  return (
    <section
      aria-labelledby="client-shell-offline-title"
      aria-live="polite"
      className="border-destructive/20 border-b bg-destructive/5 px-5 py-4 sm:px-8"
      role="status"
    >
      <div className="mx-auto flex w-full max-w-3xl items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center border border-destructive/20 bg-background text-destructive">
          <WifiOff aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="font-medium text-sm" id="client-shell-offline-title">
            You’re offline
          </h2>
          <p className="text-muted-foreground text-xs/relaxed">
            Cantiara needs an active internet connection to read and save
            changes.
          </p>
          <p className="text-muted-foreground text-xs/relaxed">
            <span className="font-medium text-foreground">Last saved</span>{" "}
            {state.lastSavedAt ? (
              <time dateTime={state.lastSavedAt.toISOString()}>
                {formatLastSaved(state.lastSavedAt, preferences)}
              </time>
            ) : (
              "Not yet"
            )}
          </p>
          {state.hasUnsavedChanges ? (
            <p className="font-medium text-destructive text-xs/relaxed">
              Unsaved changes may be lost
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function runOnlineOnlyWrite<T>(write: () => Promise<T>) {
  return defaultClientShell.runWrite(write);
}
