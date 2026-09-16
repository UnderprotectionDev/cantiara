export const TAURI_AUTH_CODE_LIFETIME_MS = 5 * 60 * 1000;
export const TAURI_AUTH_CODE_IDENTIFIER_PREFIX = "tauri-auth-code:";

export interface TauriAuthCodeStore {
  consume: (identifier: string, now: Date) => Promise<string | null>;
  create: (
    identifier: string,
    sessionId: string,
    expiresAt: Date,
  ) => Promise<void>;
}

export interface TauriSessionToken {
  accountId: string;
  expiresAt: Date;
  token: string;
}

export interface TauriSessionTokenStore {
  find: (sessionId: string) => Promise<TauriSessionToken | null>;
}

export interface TauriSessionAccess {
  exchangeCode: (code: string) => Promise<TauriSessionToken | null>;
  issueCode: (sessionId: string) => Promise<string>;
}

interface TauriSessionAccessOptions {
  authorizeSession?: (principal: {
    accountId: string;
    sessionId: string;
  }) => Promise<boolean>;
  codeStore: TauriAuthCodeStore;
  now?: () => Date;
  randomCode?: () => string;
  sessions: TauriSessionTokenStore;
}

function createRandomCode() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64url",
  );
}

async function codeIdentifier(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return `${TAURI_AUTH_CODE_IDENTIFIER_PREFIX}${Buffer.from(digest).toString("hex")}`;
}

export function createTauriSessionAccess({
  authorizeSession,
  codeStore,
  now = () => new Date(),
  randomCode = createRandomCode,
  sessions,
}: TauriSessionAccessOptions): TauriSessionAccess {
  return {
    async exchangeCode(code) {
      const currentTime = now();
      const sessionId = await codeStore.consume(
        await codeIdentifier(code),
        currentTime,
      );
      if (!sessionId) {
        return null;
      }

      const session = await sessions.find(sessionId);
      if (!session || session.expiresAt <= currentTime) {
        return null;
      }

      if (
        authorizeSession &&
        !(await authorizeSession({
          accountId: session.accountId,
          sessionId,
        }))
      ) {
        return null;
      }

      return session;
    },
    async issueCode(sessionId) {
      const code = randomCode();
      const expiresAt = new Date(now().getTime() + TAURI_AUTH_CODE_LIFETIME_MS);
      await codeStore.create(await codeIdentifier(code), sessionId, expiresAt);
      return code;
    },
  };
}
