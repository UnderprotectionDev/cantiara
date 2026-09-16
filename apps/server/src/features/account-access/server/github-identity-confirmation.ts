import {
  type AccountSessionPrincipal,
  CONFIRM_GITHUB_IDENTITY_OPERATION_IDS,
  type ConfirmGitHubIdentityOperationId,
} from "@cantiara/api/context";

export const CONFIRM_GITHUB_IDENTITY_GRANT_LIFETIME_MS = 10 * 60 * 1000;
export const CONFIRM_GITHUB_IDENTITY_STATE_LIFETIME_MS =
  CONFIRM_GITHUB_IDENTITY_GRANT_LIFETIME_MS;
export const CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX =
  "confirm-github-state:";
export const CONFIRM_GITHUB_IDENTITY_GRANT_IDENTIFIER_PREFIX =
  "confirm-github-grant:";
export const CONFIRM_GITHUB_IDENTITY_FAILURE_CODE =
  "CONFIRM_GITHUB_IDENTITY_FAILURE";
export const CONFIRM_GITHUB_IDENTITY_START_PATH =
  "/api/auth/confirm-github-identity/start";
export const CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH =
  "/api/auth/confirm-github-identity/callback";

export interface GitHubIdentityConfirmationState {
  accountId: string;
  codeVerifier: string;
  operationId: ConfirmGitHubIdentityOperationId;
  sessionId: string;
}

export interface GitHubIdentityConfirmationGrant {
  accountId: string;
  operationId: ConfirmGitHubIdentityOperationId;
}

export interface GitHubIdentityConfirmationStore {
  consumeGrant: (
    identifier: string,
    grant: GitHubIdentityConfirmationGrant,
    now: Date,
  ) => Promise<boolean>;
  consumeState: (
    identifier: string,
    now: Date,
  ) => Promise<GitHubIdentityConfirmationState | null>;
  createGrant: (
    identifier: string,
    grant: GitHubIdentityConfirmationGrant,
    expiresAt: Date,
  ) => Promise<void>;
  createState: (
    identifier: string,
    state: GitHubIdentityConfirmationState,
    expiresAt: Date,
  ) => Promise<void>;
}

export interface GitHubIdentityConfirmationAccountStore {
  findGitHubIdentityId: (accountId: string) => Promise<string | null>;
}

export interface GitHubIdentityConfirmationOAuth {
  createAuthorizationUrl: (input: {
    codeChallenge: string;
    state: string;
  }) => string;
  exchangeAuthorizationCode: (input: {
    code: string;
    codeVerifier: string;
  }) => Promise<string | null>;
}

export type GitHubIdentityConfirmationAuditType =
  | "github.identity-confirmation.failed"
  | "github.identity-confirmation.started"
  | "github.identity-confirmation.succeeded";

export interface GitHubIdentityConfirmationAuditRecord {
  actorAlias: string;
  id: string;
  occurredAt: string;
  targetSessionAlias: string;
  type: GitHubIdentityConfirmationAuditType;
}

export interface GitHubIdentityConfirmationAuditStore {
  append: (record: GitHubIdentityConfirmationAuditRecord) => Promise<void>;
}

export interface GitHubIdentityConfirmationRateLimit {
  consume: (input: {
    accountId: string;
    clientKey: string;
    stage: "callback" | "consume" | "start";
  }) => Promise<boolean>;
}

export interface GitHubIdentityConfirmation {
  complete: (
    principal: AccountSessionPrincipal,
    input: { code: string; state: string },
    clientKey?: string,
  ) => Promise<string | null>;
  consume: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    grant: string,
    clientKey?: string,
  ) => Promise<boolean>;
  recordFailure: (
    principal: AccountSessionPrincipal,
    state?: string,
    clientKey?: string,
  ) => Promise<void>;
  start: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    clientKey?: string,
  ) => Promise<{ authorizationUrl: string } | null>;
}

interface GitHubIdentityConfirmationOptions {
  accountIdentities: GitHubIdentityConfirmationAccountStore;
  auditRecords?: GitHubIdentityConfirmationAuditStore;
  authorizeSession?: (principal: AccountSessionPrincipal) => Promise<boolean>;
  githubOAuth: GitHubIdentityConfirmationOAuth;
  issueGrant?: (input: {
    auditRecord: GitHubIdentityConfirmationAuditRecord;
    expiresAt: Date;
    grant: GitHubIdentityConfirmationGrant;
    identifier: string;
  }) => Promise<void>;
  now?: () => Date;
  randomValue?: () => string;
  rateLimit?: GitHubIdentityConfirmationRateLimit;
  store: GitHubIdentityConfirmationStore;
}

const OPERATION_IDS = new Set<string>(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS);
const BASE64_URL_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BASE64_URL_PADDING_PATTERN = /[=]+$/;

export function isConfirmGitHubIdentityOperationId(
  value: unknown,
): value is ConfirmGitHubIdentityOperationId {
  return typeof value === "string" && OPERATION_IDS.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPrincipalValues(
  principal: unknown,
): principal is AccountSessionPrincipal {
  return (
    isRecord(principal) &&
    typeof principal.accountId === "string" &&
    principal.accountId.length > 0 &&
    typeof principal.sessionId === "string" &&
    principal.sessionId.length > 0
  );
}

function isConfirmationInput(
  input: unknown,
): input is { code: string; state: string } {
  return (
    isRecord(input) &&
    typeof input.code === "string" &&
    typeof input.state === "string"
  );
}

function isValidConfirmationInput(input: unknown) {
  return (
    isConfirmationInput(input) &&
    input.code.length > 0 &&
    input.code.length <= 512 &&
    BASE64_URL_VALUE_PATTERN.test(input.state)
  );
}

function isUsableState(
  state: GitHubIdentityConfirmationState | null,
  principal: AccountSessionPrincipal,
): state is GitHubIdentityConfirmationState {
  return Boolean(
    state &&
      isConfirmGitHubIdentityOperationId(state.operationId) &&
      state.accountId === principal.accountId &&
      state.sessionId === principal.sessionId,
  );
}

function createRandomValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_URL_PADDING_PATTERN, "");
}

async function createCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_URL_PADDING_PATTERN, "");
}

async function identifierFor(prefix: string, value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `${prefix}${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

async function grantIdentifier(
  grant: string,
  accountId: string,
  operationId: ConfirmGitHubIdentityOperationId,
) {
  const [grantAlias, accountAlias] = await Promise.all([
    identifierFor("", grant),
    identifierFor("", accountId),
  ]);
  return `${CONFIRM_GITHUB_IDENTITY_GRANT_IDENTIFIER_PREFIX}${grantAlias}:${accountAlias}:${operationId}`;
}

async function stateIdentifier(
  state: string,
  accountId: string,
  sessionId: string,
) {
  const [stateAlias, accountAlias, sessionAlias] = await Promise.all([
    identifierFor("", state),
    identifierFor("", accountId),
    identifierFor("", sessionId),
  ]);
  return `${CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX}${stateAlias}:${accountAlias}:${sessionAlias}`;
}

function actorAlias(accountId: string) {
  return identifierFor("account:", accountId);
}

export function createGitHubIdentityConfirmation({
  accountIdentities,
  authorizeSession,
  auditRecords,
  githubOAuth,
  issueGrant,
  now = () => new Date(),
  rateLimit,
  randomValue = createRandomValue,
  store,
}: GitHubIdentityConfirmationOptions): GitHubIdentityConfirmation {
  async function createAuditRecord(
    type: GitHubIdentityConfirmationAuditType,
    principal: AccountSessionPrincipal,
    targetSessionAlias: string,
    occurredAt: Date,
  ): Promise<GitHubIdentityConfirmationAuditRecord> {
    return {
      actorAlias: await actorAlias(principal.accountId),
      id: crypto.randomUUID(),
      occurredAt: occurredAt.toISOString(),
      targetSessionAlias,
      type,
    };
  }

  async function appendAuditRecord(
    record: GitHubIdentityConfirmationAuditRecord,
  ): Promise<boolean> {
    if (!auditRecords) {
      return true;
    }

    try {
      await auditRecords.append(record);
      return true;
    } catch {
      return false;
    }
  }

  async function appendAudit(
    type: GitHubIdentityConfirmationAuditType,
    principal: AccountSessionPrincipal,
    targetSessionAlias: string,
    occurredAt: Date,
  ): Promise<boolean> {
    try {
      return appendAuditRecord(
        await createAuditRecord(
          type,
          principal,
          targetSessionAlias,
          occurredAt,
        ),
      );
    } catch {
      return false;
    }
  }

  function appendFailureAudit(
    principal: AccountSessionPrincipal,
    targetSessionAlias: string,
    occurredAt = now(),
  ): Promise<boolean> {
    return appendAudit(
      "github.identity-confirmation.failed",
      principal,
      targetSessionAlias,
      occurredAt,
    );
  }

  async function appendFailureAuditSafely(
    principal: unknown,
    targetSessionAlias: string,
    occurredAt?: Date,
  ) {
    if (!hasPrincipalValues(principal)) {
      return;
    }

    try {
      await appendFailureAudit(principal, targetSessionAlias, occurredAt);
    } catch {
      // Audit storage cannot turn a rejected confirmation into a success.
    }
  }

  async function isRateLimitAllowed(input: {
    accountId: string;
    clientKey: string;
    stage: "callback" | "consume" | "start";
  }) {
    if (!rateLimit) {
      return true;
    }

    try {
      return await rateLimit.consume(input);
    } catch {
      return false;
    }
  }

  async function issueConfirmationGrant(
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    stateIdentifierValue: string,
    currentTime: Date,
  ) {
    const grant = randomValue();
    if (!BASE64_URL_VALUE_PATTERN.test(grant)) {
      await appendFailureAudit(principal, stateIdentifierValue, currentTime);
      return null;
    }

    const grantRecord = {
      accountId: principal.accountId,
      operationId,
    } satisfies GitHubIdentityConfirmationGrant;
    const grantIdentifierValue = await grantIdentifier(
      grant,
      grantRecord.accountId,
      grantRecord.operationId,
    );
    const expiresAt = new Date(
      currentTime.getTime() + CONFIRM_GITHUB_IDENTITY_GRANT_LIFETIME_MS,
    );
    const succeededAuditRecord = await createAuditRecord(
      "github.identity-confirmation.succeeded",
      principal,
      grantIdentifierValue,
      currentTime,
    );
    if (issueGrant) {
      await issueGrant({
        auditRecord: succeededAuditRecord,
        expiresAt,
        grant: grantRecord,
        identifier: grantIdentifierValue,
      });
      return grant;
    }

    await store.createGrant(grantIdentifierValue, grantRecord, expiresAt);
    if (await appendAuditRecord(succeededAuditRecord)) {
      return grant;
    }

    try {
      await store.consumeGrant(grantIdentifierValue, grantRecord, currentTime);
    } catch {
      // An unreachable, unreturned grant remains unusable without its random value.
    }
    return null;
  }

  return {
    async recordFailure(principal, state, clientKey = "unknown") {
      if (!hasPrincipalValues(principal)) {
        return;
      }

      let currentTime: Date;
      try {
        currentTime = now();
      } catch {
        return;
      }

      if (
        !(await isRateLimitAllowed({
          accountId: principal.accountId,
          clientKey,
          stage: "callback",
        }))
      ) {
        return;
      }

      let targetSessionAlias = CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX;
      if (typeof state === "string" && BASE64_URL_VALUE_PATTERN.test(state)) {
        try {
          targetSessionAlias = await stateIdentifier(
            state,
            principal.accountId,
            principal.sessionId,
          );
          await store.consumeState(targetSessionAlias, currentTime);
        } catch {
          // A malformed or unavailable state store cannot turn this failure into a grant.
        }
      }

      await appendFailureAuditSafely(
        principal,
        targetSessionAlias,
        currentTime,
      );
    },
    async consume(principal, operationId, grant, clientKey = "unknown") {
      if (
        !(
          hasPrincipalValues(principal) &&
          isConfirmGitHubIdentityOperationId(operationId) &&
          BASE64_URL_VALUE_PATTERN.test(grant)
        )
      ) {
        return false;
      }

      try {
        const currentTime = now();
        if (authorizeSession && !(await authorizeSession(principal))) {
          await appendFailureAudit(
            principal,
            CONFIRM_GITHUB_IDENTITY_GRANT_IDENTIFIER_PREFIX,
            currentTime,
          );
          return false;
        }

        if (
          !(await isRateLimitAllowed({
            accountId: principal.accountId,
            clientKey,
            stage: "consume",
          }))
        ) {
          return false;
        }

        const consumed = await store.consumeGrant(
          await grantIdentifier(grant, principal.accountId, operationId),
          {
            accountId: principal.accountId,
            operationId,
          },
          currentTime,
        );
        const grantIdentifierValue = await grantIdentifier(
          grant,
          principal.accountId,
          operationId,
        );
        if (consumed) {
          if (
            !(await appendAudit(
              "github.identity-confirmation.succeeded",
              principal,
              grantIdentifierValue,
              currentTime,
            ))
          ) {
            return false;
          }
        } else {
          await appendFailureAudit(
            principal,
            grantIdentifierValue,
            currentTime,
          );
        }
        return consumed;
      } catch {
        await appendFailureAuditSafely(
          principal,
          CONFIRM_GITHUB_IDENTITY_GRANT_IDENTIFIER_PREFIX,
        );
        return false;
      }
    },
    async complete(principal, input, clientKey = "unknown") {
      if (!(hasPrincipalValues(principal) && isValidConfirmationInput(input))) {
        return null;
      }

      try {
        const currentTime = now();
        if (authorizeSession && !(await authorizeSession(principal))) {
          await appendFailureAudit(
            principal,
            CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
            currentTime,
          );
          return null;
        }

        if (
          !(await isRateLimitAllowed({
            accountId: principal.accountId,
            clientKey,
            stage: "callback",
          }))
        ) {
          return null;
        }

        const stateIdentifierValue = await stateIdentifier(
          input.state,
          principal.accountId,
          principal.sessionId,
        );
        const state = await store.consumeState(
          stateIdentifierValue,
          currentTime,
        );
        if (!isUsableState(state, principal)) {
          await appendFailureAudit(
            principal,
            stateIdentifierValue,
            currentTime,
          );
          return null;
        }

        const githubIdentityId = await accountIdentities.findGitHubIdentityId(
          principal.accountId,
        );
        if (!githubIdentityId) {
          await appendFailureAudit(
            principal,
            stateIdentifierValue,
            currentTime,
          );
          return null;
        }

        const returnedIdentityId = await githubOAuth.exchangeAuthorizationCode({
          code: input.code,
          codeVerifier: state.codeVerifier,
        });
        if (!returnedIdentityId || returnedIdentityId !== githubIdentityId) {
          await appendFailureAudit(
            principal,
            stateIdentifierValue,
            currentTime,
          );
          return null;
        }

        return issueConfirmationGrant(
          principal,
          state.operationId,
          stateIdentifierValue,
          currentTime,
        );
      } catch {
        await appendFailureAuditSafely(
          principal,
          CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
        );
        return null;
      }
    },
    async start(principal, operationId, clientKey = "unknown") {
      if (
        !(
          hasPrincipalValues(principal) &&
          isConfirmGitHubIdentityOperationId(operationId)
        )
      ) {
        return null;
      }
      try {
        const currentTime = now();
        if (authorizeSession && !(await authorizeSession(principal))) {
          await appendFailureAudit(
            principal,
            CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
            currentTime,
          );
          return null;
        }

        if (
          !(await isRateLimitAllowed({
            accountId: principal.accountId,
            clientKey,
            stage: "start",
          }))
        ) {
          return null;
        }

        const githubIdentityId = await accountIdentities.findGitHubIdentityId(
          principal.accountId,
        );
        if (!githubIdentityId) {
          await appendFailureAudit(
            principal,
            CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
            currentTime,
          );
          return null;
        }

        const state = randomValue();
        const codeVerifier = randomValue();
        if (
          !(
            BASE64_URL_VALUE_PATTERN.test(state) &&
            BASE64_URL_VALUE_PATTERN.test(codeVerifier)
          )
        ) {
          await appendFailureAudit(
            principal,
            CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
            currentTime,
          );
          return null;
        }

        const stateIdentifierValue = await stateIdentifier(
          state,
          principal.accountId,
          principal.sessionId,
        );
        await store.createState(
          stateIdentifierValue,
          {
            accountId: principal.accountId,
            codeVerifier,
            operationId,
            sessionId: principal.sessionId,
          },
          new Date(
            currentTime.getTime() + CONFIRM_GITHUB_IDENTITY_STATE_LIFETIME_MS,
          ),
        );

        const result = {
          authorizationUrl: githubOAuth.createAuthorizationUrl({
            codeChallenge: await createCodeChallenge(codeVerifier),
            state,
          }),
        };
        if (
          !(await appendAudit(
            "github.identity-confirmation.started",
            principal,
            stateIdentifierValue,
            currentTime,
          ))
        ) {
          return null;
        }
        return result;
      } catch {
        await appendFailureAuditSafely(
          principal,
          CONFIRM_GITHUB_IDENTITY_STATE_IDENTIFIER_PREFIX,
        );
        return null;
      }
    },
  };
}
