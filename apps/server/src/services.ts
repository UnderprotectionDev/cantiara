import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";
import { createSecurityEventDb } from "@cantiara/db/security-events";

import { desktopOrigins, env } from "./env";
import { createDatabaseAccountAdmission } from "./features/account-access/server/account-admission";
import { createGitHubAvailability } from "./features/account-access/server/github-availability";
import { CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH } from "./features/account-access/server/github-identity-confirmation";
import { createDatabaseGitHubIdentityConfirmation } from "./features/account-access/server/github-identity-confirmation-database";
import { createDatabaseAccountSessionAccess } from "./features/account-access/server/session-access-database";
import { createDatabaseTauriSessionAccess } from "./features/account-access/server/tauri-session-database";
import {
  accountPreferencesMutationTarget,
  createDatabaseAccountPreferences,
} from "./features/account-preferences/server/account-preferences-database";
import {
  CaptureInboxError,
  type CaptureInboxWorkCreate,
} from "./features/capture-triage/server/capture-inbox";
import {
  captureInboxMutationTarget,
  createDatabaseCaptureInbox,
} from "./features/capture-triage/server/capture-inbox-database";
import { createDatabaseMutationContract } from "./features/mutation-and-undo/server/mutation-contract-database";

const db = createDb(env);
const securityEventDb = createSecurityEventDb({
  DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
});
const accountAdmission = createDatabaseAccountAdmission(db);
const databaseAccountPreferences = createDatabaseAccountPreferences(db);
export const accountPreferences = databaseAccountPreferences;
export const accountPreferencesCompatibility = databaseAccountPreferences;
export const accountPreferencesMutationContract =
  createDatabaseMutationContract<AccountPreferences>(db, {
    target: accountPreferencesMutationTarget,
  });
export const mutationContract =
  createDatabaseMutationContract<MutationPayload>(db);
export const captureInboxMutationContract =
  createDatabaseMutationContract<MutationPayload>(db, {
    target: captureInboxMutationTarget,
  });
// Work Lifecycle owns key allocation and persistence; Capture Inbox only hands
// an eligible direct Create Bug command across that boundary for now.
const captureInboxWorkCreate: CaptureInboxWorkCreate = {
  createBug: () => {
    throw new CaptureInboxError(
      "CAPTURE_WORK_CREATE_UNAVAILABLE",
      "Work creation is not available yet.",
    );
  },
};
export const captureInbox = createDatabaseCaptureInbox(
  db,
  captureInboxWorkCreate,
  captureInboxMutationContract,
);
export const githubAvailability = createGitHubAvailability();
export const accountSessionAccess = createDatabaseAccountSessionAccess(
  db,
  securityEventDb,
  { onGitHubLoginOAuthRevoked: githubAvailability.requireFreshConsent },
);
export const githubIdentityConfirmation =
  createDatabaseGitHubIdentityConfirmation(db, {
    authorizeSession: (principal) =>
      accountSessionAccess.authorizeWrite(principal),
    callbackURL: new URL(
      CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH,
      env.BETTER_AUTH_URL,
    ).href,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    githubAvailability,
  });
export const tauriSessionAccess = createDatabaseTauriSessionAccess(
  db,
  accountSessionAccess,
  securityEventDb,
);
let securityReplay: Promise<void> | undefined;

export function replaySessionRevocations() {
  if (!securityReplay) {
    securityReplay = accountSessionAccess
      .replaySessionRevocations()
      .catch((error) => {
        securityReplay = undefined;
        throw error;
      });
  }
  return securityReplay;
}

// The GitHub login OAuth adapter calls this signal when its authorization is revoked.
// GitHub App installation signals must not call it.
export function notifyGitHubLoginOAuthRevoked(accountId: string) {
  return accountSessionAccess.revokeGitHubLoginOAuth(accountId);
}

export function getDb(): Database {
  return db;
}
export const auth = createAuth(
  env,
  db,
  accountAdmission,
  desktopOrigins,
  githubAvailability,
);
