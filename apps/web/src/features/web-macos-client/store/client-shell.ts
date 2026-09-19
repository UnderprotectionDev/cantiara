import {
  DESKTOP_API_CONTRACT_HEADER,
  DESKTOP_API_CURRENT_CONTRACT,
  isDesktopApiUpdateRequiredResponse,
} from "@cantiara/api/desktop-api-window";
import { createStore } from "@tanstack/react-store";

import { isTauriRuntime } from "@/features/account-access/lib/tauri-session";

export type ClientConnectionState = "online" | "offline";

export interface ClientShellState {
  connection: ClientConnectionState;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  updateRequired: boolean;
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
  setUpdateRequired: (updateRequired: boolean) => void;
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

export class ClientShellUpdateRequiredError extends Error {
  constructor() {
    super("Update required");
    this.name = "ClientShellUpdateRequiredError";
  }
}

interface CreateClientShellOptions {
  initialConnection?: ClientConnectionState;
  initialLastSavedAt?: Date | null;
  initialUnsavedChanges?: boolean;
  initialUpdateRequired?: boolean;
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
    updateRequired: options.initialUpdateRequired ?? false,
  });
  const now = options.now ?? (() => new Date());

  function update(next: Partial<ClientShellState>) {
    store.setState((state) => {
      const updatedState = { ...state, ...next };
      if (
        updatedState.connection === state.connection &&
        updatedState.hasUnsavedChanges === state.hasUnsavedChanges &&
        updatedState.lastSavedAt?.getTime() === state.lastSavedAt?.getTime() &&
        updatedState.updateRequired === state.updateRequired
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

  function assertUpdateAllowed() {
    if (store.state.updateRequired) {
      throw new ClientShellUpdateRequiredError();
    }
  }

  function setConnectionState(connection: ClientConnectionState) {
    update({ connection });
  }

  function setUpdateRequired(updateRequired: boolean) {
    update({ updateRequired });
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
    const requestInit = { ...init };
    if (isTauriRuntime()) {
      const headers = new Headers(init?.headers);
      if (!headers.has(DESKTOP_API_CONTRACT_HEADER)) {
        headers.set(DESKTOP_API_CONTRACT_HEADER, DESKTOP_API_CURRENT_CONTRACT);
      }
      requestInit.headers = headers;
    }
    try {
      const response = await fetcher(input, requestInit);
      if (isDesktopApiUpdateRequiredResponse(response)) {
        setUpdateRequired(true);
      }
      setConnectionState("online");
      return response;
    } catch (error) {
      recordNetworkFailure(error);
      throw error;
    }
  }

  async function runOnlineOnly<T>(operation: () => Promise<T>) {
    assertOnline();
    assertUpdateAllowed();
    try {
      return await operation();
    } catch (error) {
      recordNetworkFailure(error);
      throw error;
    }
  }

  async function runWrite<T>(write: () => Promise<T>) {
    const result = await runOnlineOnly(write);
    if (
      typeof Response !== "undefined" &&
      result instanceof Response &&
      isDesktopApiUpdateRequiredResponse(result)
    ) {
      throw new ClientShellUpdateRequiredError();
    }
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
    setUpdateRequired,
    setConnectionState,
    subscribe: (listener) => store.subscribe(listener),
  };
}

export const defaultClientShell = createClientShell();

export function runOnlineOnlyWrite<T>(write: () => Promise<T>) {
  return defaultClientShell.runOnlineOnly(write);
}
