import type { Client } from "@tauri-apps/plugin-stronghold";

import { env } from "@/env";

export const TAURI_AUTH_CALLBACK_URL = "cantiara://auth/callback";

const STRONGHOLD_CLIENT = "account-access";
const STRONGHOLD_TOKEN_KEY = "bearer-session";
const STRONGHOLD_CODE_VERIFIER_KEY = "code-verifier";
const STRONGHOLD_VAULT_FILE = "account-access.hold";
const BASE64_URL_PADDING_PATTERN = /[=]+$/;
const TRAILING_SLASH_PATTERN = /\/$/;

export interface TauriBearerTokenStore {
  clearCodeVerifier: () => Promise<void>;
  read: () => Promise<string | null>;
  readCodeVerifier: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  writeCodeVerifier: (codeVerifier: string) => Promise<void>;
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

function createRandomBase64UrlValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(BASE64_URL_PADDING_PATTERN, "");
}

export async function createTauriAuthCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(BASE64_URL_PADDING_PATTERN, "");
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
  const [{ invoke }, { appDataDir }, { Stronghold }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/path"),
    import("@tauri-apps/plugin-stronghold"),
  ]);
  const vaultPath = `${(await appDataDir()).replace(TRAILING_SLASH_PATTERN, "")}/${STRONGHOLD_VAULT_FILE}`;
  const vaultPassword = await invoke<string>(
    "get_or_create_stronghold_password",
    { candidate: createRandomBase64UrlValue() },
  );
  const stronghold = await Stronghold.load(vaultPath, vaultPassword);

  let client: Client;
  try {
    client = await stronghold.loadClient(STRONGHOLD_CLIENT);
  } catch {
    client = await stronghold.createClient(STRONGHOLD_CLIENT);
  }
  const store = client.getStore();

  async function readValue(key: string) {
    const value = await store.get(key);
    return value ? new TextDecoder().decode(value) : null;
  }

  async function writeValue(key: string, value: string) {
    await store.insert(key, Array.from(new TextEncoder().encode(value)));
    await stronghold.save();
  }

  return {
    async clearCodeVerifier() {
      await store.remove(STRONGHOLD_CODE_VERIFIER_KEY);
      await stronghold.save();
    },
    read() {
      return readValue(STRONGHOLD_TOKEN_KEY);
    },
    readCodeVerifier() {
      return readValue(STRONGHOLD_CODE_VERIFIER_KEY);
    },
    async write(token) {
      await writeValue(STRONGHOLD_TOKEN_KEY, token);
    },
    async writeCodeVerifier(codeVerifier) {
      await writeValue(STRONGHOLD_CODE_VERIFIER_KEY, codeVerifier);
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
      clearCodeVerifier: async () => {
        if (!isTauriRuntime()) {
          return;
        }
        await (await getTokenStore()).clearCodeVerifier();
      },
      read: () => getTauriBearerToken(),
      readCodeVerifier: async () => {
        if (!isTauriRuntime()) {
          return null;
        }
        return (await getTokenStore()).readCodeVerifier();
      },
      write: async (token) => {
        if (!isTauriRuntime()) {
          return;
        }
        await (await getTokenStore()).write(token);
      },
      writeCodeVerifier: async (codeVerifier) => {
        if (!isTauriRuntime()) {
          return;
        }
        await (await getTokenStore()).writeCodeVerifier(codeVerifier);
      },
    },
  },
) {
  const codeVerifier = await dependencies.tokenStore.readCodeVerifier();
  if (!codeVerifier) {
    throw new Error("Tauri auth code verifier is missing");
  }

  const response = await dependencies.fetch(
    `${dependencies.serverURL.replace(TRAILING_SLASH_PATTERN, "")}/api/auth/tauri/exchange`,
    {
      body: JSON.stringify({ code, codeVerifier }),
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
  await dependencies.tokenStore.clearCodeVerifier();
}

export async function openTauriGitHubSignIn() {
  const codeVerifier = createRandomBase64UrlValue();
  const codeChallenge = await createTauriAuthCodeChallenge(codeVerifier);
  const tokenStore = await getTokenStore();
  await tokenStore.writeCodeVerifier(codeVerifier);

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    const startURL = new URL("/api/auth/tauri/start", env.VITE_SERVER_URL);
    startURL.searchParams.set("code_challenge", codeChallenge);
    await openUrl(startURL.href);
  } catch (error) {
    await tokenStore.clearCodeVerifier().catch(() => undefined);
    throw error;
  }
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
