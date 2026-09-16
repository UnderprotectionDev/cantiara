import type { Client } from "@tauri-apps/plugin-stronghold";

import { env } from "@/env";

export const TAURI_AUTH_CALLBACK_URL = "cantiara://auth/callback";

const STRONGHOLD_CLIENT = "account-access";
const STRONGHOLD_VAULT_PASSWORD = "cantiara-account-access-v1";
const STRONGHOLD_TOKEN_KEY = "bearer-session";
const STRONGHOLD_VAULT_FILE = "account-access.hold";
const TRAILING_SLASH_PATTERN = /\/$/;

export interface TauriBearerTokenStore {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
}

export interface TauriAuthCallbackCode {
  code: string;
}

export interface TauriAuthCallbackError {
  error: string;
}

interface TauriAuthExchangeDependencies {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  serverURL: string;
  tokenStore: TauriBearerTokenStore;
}

function expectedCallbackURL() {
  return new URL(TAURI_AUTH_CALLBACK_URL);
}

export function isTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>)
  );
}

export function parseTauriAuthCallback(
  value: string,
): TauriAuthCallbackCode | TauriAuthCallbackError | null {
  let callbackURL: URL;
  try {
    callbackURL = new URL(value);
  } catch {
    return null;
  }

  const expected = expectedCallbackURL();
  if (
    callbackURL.protocol !== expected.protocol ||
    callbackURL.hostname !== expected.hostname ||
    callbackURL.pathname !== expected.pathname ||
    callbackURL.username ||
    callbackURL.password ||
    callbackURL.port ||
    callbackURL.hash
  ) {
    return null;
  }

  const keys = [...callbackURL.searchParams.keys()];
  if (keys.length === 1 && keys[0] === "code") {
    const code = callbackURL.searchParams.get("code");
    return code ? { code } : null;
  }
  if (keys.length === 1 && keys[0] === "error") {
    const error = callbackURL.searchParams.get("error");
    return error ? { error } : null;
  }
  return null;
}

async function createStrongholdTokenStore(): Promise<TauriBearerTokenStore> {
  const [{ appDataDir }, { Stronghold }] = await Promise.all([
    import("@tauri-apps/api/path"),
    import("@tauri-apps/plugin-stronghold"),
  ]);
  const vaultPath = `${(await appDataDir()).replace(TRAILING_SLASH_PATTERN, "")}/${STRONGHOLD_VAULT_FILE}`;
  const stronghold = await Stronghold.load(
    vaultPath,
    STRONGHOLD_VAULT_PASSWORD,
  );

  let client: Client;
  try {
    client = await stronghold.loadClient(STRONGHOLD_CLIENT);
  } catch {
    client = await stronghold.createClient(STRONGHOLD_CLIENT);
  }
  const store = client.getStore();

  return {
    async read() {
      const value = await store.get(STRONGHOLD_TOKEN_KEY);
      return value ? new TextDecoder().decode(value) : null;
    },
    async write(token) {
      await store.insert(
        STRONGHOLD_TOKEN_KEY,
        Array.from(new TextEncoder().encode(token)),
      );
      await stronghold.save();
    },
  };
}

let tokenStorePromise: Promise<TauriBearerTokenStore> | undefined;

async function getTokenStore() {
  if (!tokenStorePromise) {
    tokenStorePromise = createStrongholdTokenStore();
  }
  try {
    return await tokenStorePromise;
  } catch (error) {
    tokenStorePromise = undefined;
    throw error;
  }
}

export async function getTauriBearerToken() {
  if (!isTauriRuntime()) {
    return null;
  }
  try {
    return await (await getTokenStore()).read();
  } catch {
    return null;
  }
}

export async function exchangeTauriAuthCode(
  code: string,
  dependencies: TauriAuthExchangeDependencies = {
    fetch: globalThis.fetch,
    serverURL: env.VITE_SERVER_URL,
    tokenStore: {
      read: () => getTauriBearerToken(),
      write: async (token) => {
        if (!isTauriRuntime()) {
          return;
        }
        await (await getTokenStore()).write(token);
      },
    },
  },
) {
  const response = await dependencies.fetch(
    `${dependencies.serverURL.replace(TRAILING_SLASH_PATTERN, "")}/api/auth/tauri/exchange`,
    {
      body: JSON.stringify({ code }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error("Tauri session exchange failed");
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string" ||
    body.token.length === 0
  ) {
    throw new Error("Tauri session exchange failed");
  }

  await dependencies.tokenStore.write(body.token);
}

export async function openTauriGitHubSignIn() {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  const startURL = new URL("/api/auth/tauri/start", env.VITE_SERVER_URL).href;
  await openUrl(startURL);
}

async function handleTauriAuthCallback(value: string) {
  const callback = parseTauriAuthCallback(value);
  if (!(callback && "code" in callback)) {
    return false;
  }

  try {
    await exchangeTauriAuthCode(callback.code);
  } catch {
    return false;
  }
  return true;
}

export async function initializeTauriAuth() {
  if (!isTauriRuntime()) {
    return;
  }

  const { getCurrent, onOpenUrl } = await import(
    "@tauri-apps/plugin-deep-link"
  );
  const processURLs = async (urls: string[], index = 0): Promise<void> => {
    const url = urls[index];
    if (!url) {
      return;
    }
    if (await handleTauriAuthCallback(url)) {
      window.location.reload();
      return;
    }
    await processURLs(urls, index + 1);
  };

  await onOpenUrl((urls) => processURLs(urls).catch(() => undefined));
  const currentURLs = await getCurrent();
  if (currentURLs) {
    await processURLs(currentURLs);
  }
}

export async function createTauriBearerHeaders(
  headers: HeadersInit | undefined,
  readToken: () => Promise<string | null> = getTauriBearerToken,
) {
  const nextHeaders = new Headers(headers);
  const token = await readToken();
  if (token && !nextHeaders.has("authorization")) {
    nextHeaders.set("authorization", `Bearer ${token}`);
  }
  return nextHeaders;
}
