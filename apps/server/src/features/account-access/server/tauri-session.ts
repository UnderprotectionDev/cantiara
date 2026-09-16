export const TAURI_AUTH_CODE_LIFETIME_MS = 5 * 60 * 1000;
export const TAURI_AUTH_CODE_IDENTIFIER_PREFIX = "tauri-auth-code:";
export const TAURI_AUTH_CODE_CONSUMED_EVENT_ID_PREFIX =
  "tauri-auth-code-consumed:";
export const TAURI_AUTH_CODE_CONSUMED_EVENT_TYPE = "tauri.auth-code.consumed";

const TAURI_AUTH_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TAURI_AUTH_CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function isTauriAuthCodeChallenge(value: string) {
  return TAURI_AUTH_CODE_CHALLENGE_PATTERN.test(value);
}

export function isTauriAuthCodeVerifier(value: string) {
  return TAURI_AUTH_CODE_VERIFIER_PATTERN.test(value);
}

export interface TauriAuthCodeRecord {
  codeChallenge: string;
  sessionId: string;
}

export interface TauriAuthCodeStore {
  consume: (
    identifier: string,
    now: Date,
  ) => Promise<TauriAuthCodeRecord | null>;
  create: (
    identifier: string,
    record: TauriAuthCodeRecord,
    expiresAt: Date,
  ) => Promise<void>;
  find: (identifier: string, now: Date) => Promise<TauriAuthCodeRecord | null>;
}

export interface TauriAuthCodeConsumptionStore {
  record: (identifier: string, occurredAt: Date) => Promise<boolean>;
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
  exchangeCode: (
    code: string,
    codeVerifier: string,
  ) => Promise<TauriSessionToken | null>;
  issueCode: (sessionId: string, codeChallenge: string) => Promise<string>;
}

interface TauriSessionAccessOptions {
  authorizeSession?: (principal: {
    accountId: string;
    sessionId: string;
  }) => Promise<boolean>;
  codeStore: TauriAuthCodeStore;
  consumedCodes: TauriAuthCodeConsumptionStore;
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
  consumedCodes,
  now = () => new Date(),
  randomCode = createRandomCode,
  sessions,
}: TauriSessionAccessOptions): TauriSessionAccess {
  return {
    async exchangeCode(code, codeVerifier) {
      if (!isTauriAuthCodeVerifier(codeVerifier)) {
        return null;
      }

      const currentTime = now();
      const identifier = await codeIdentifier(code);
      const record = await codeStore.find(identifier, currentTime);
      if (!record) {
        return null;
      }

      const codeChallenge = await codeChallengeForVerifier(codeVerifier);
      if (record.codeChallenge !== codeChallenge) {
        return null;
      }

      if (!(await consumedCodes.record(identifier, currentTime))) {
        return null;
      }

      const consumedRecord = await codeStore.consume(identifier, currentTime);
      if (
        !consumedRecord ||
        consumedRecord.sessionId !== record.sessionId ||
        consumedRecord.codeChallenge !== record.codeChallenge
      ) {
        return null;
      }

      const session = await sessions.find(consumedRecord.sessionId);
      if (!session || session.expiresAt <= currentTime) {
        return null;
      }

      if (
        authorizeSession &&
        !(await authorizeSession({
          accountId: session.accountId,
          sessionId: consumedRecord.sessionId,
        }))
      ) {
        return null;
      }

      return session;
    },
    async issueCode(sessionId, codeChallenge) {
      if (!isTauriAuthCodeChallenge(codeChallenge)) {
        throw new Error("Invalid Tauri auth code challenge");
      }

      const code = randomCode();
      const expiresAt = new Date(now().getTime() + TAURI_AUTH_CODE_LIFETIME_MS);
      await codeStore.create(
        await codeIdentifier(code),
        { codeChallenge, sessionId },
        expiresAt,
      );
      return code;
    },
  };
}

async function codeChallengeForVerifier(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return Buffer.from(digest).toString("base64url");
}
