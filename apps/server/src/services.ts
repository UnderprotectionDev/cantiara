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
  captureInboxMutationTarget,
  createDatabaseCaptureInbox,
} from "./features/capture-triage/server/capture-inbox-database";
import { createDevelopmentCaptureInboxTriageAdapter } from "./features/capture-triage/server/capture-inbox-development-adapter";
import { createCaptureInboxWorkCreate } from "./features/capture-triage/server/capture-work-create";
import { createDatabaseWebCapture } from "./features/capture-triage/server/web-capture-database";
import {
  createR2CaptureInboxStagingStore,
  createR2WebCaptureStagingStore,
} from "./features/capture-triage/server/web-capture-staging-r2";
import { createDatabaseCustomFields } from "./features/custom-fields/server/custom-fields-database";
import {
  createDatabaseCustomFieldFinalizationWriter,
  createDatabaseCustomFieldMutationContracts,
} from "./features/custom-fields/server/custom-fields-mutation-database";
import { createDatabaseMutationContract } from "./features/mutation-and-undo/server/mutation-contract-database";
import { createDatabaseProjectShell } from "./features/project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "./features/project-shell/server/project-shell-mutation-database";
import { createDatabaseRelations } from "./features/relations/server/relations";
import {
  createDatabaseUsageLinkMutationContracts,
  createDatabaseUsageLinks,
} from "./features/relations/server/usage-links-database";
import {
  createDatabaseTagMutationContracts,
  createDatabaseTags,
} from "./features/tags/server/tags-database";
import { createDatabaseWorkDrafts } from "./features/work-drafts/server/work-drafts-database";
import { createDatabaseWorkLifecycle } from "./features/work-lifecycle/server/work-lifecycle-database";

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
export const projectShell = createDatabaseProjectShell(db);
export const projectShellMutationContracts =
  createDatabaseProjectShellMutationContracts(db);
export const relations = createDatabaseRelations(db);
export const usageLinks = createDatabaseUsageLinks(db);
export const usageLinkMutationContracts =
  createDatabaseUsageLinkMutationContracts(db);
export const tags = createDatabaseTags(db);
export const tagMutationContracts = createDatabaseTagMutationContracts(db);
export const customFields = createDatabaseCustomFields(db);
export const customFieldMutationContracts =
  createDatabaseCustomFieldMutationContracts(db);
export const workLifecycle = createDatabaseWorkLifecycle(db, {
  customFieldValueWriter: createDatabaseCustomFieldFinalizationWriter(),
});
export const workDrafts = createDatabaseWorkDrafts(
  db,
  workLifecycle,
  projectShell,
);
export const captureInboxMutationContract =
  createDatabaseMutationContract<MutationPayload>(db, {
    target: captureInboxMutationTarget,
  });

// Work Lifecycle owns key allocation and persistence; Capture Inbox only hands
// eligible direct or converted Work creates across that boundary.
const captureInboxWorkCreate = createCaptureInboxWorkCreate(workLifecycle);
const webCaptureStaging =
  env.R2_ACCESS_KEY_ID &&
  env.R2_ACCOUNT_ID &&
  env.R2_BUCKET &&
  env.R2_SECRET_ACCESS_KEY
    ? createR2WebCaptureStagingStore({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        accountId: env.R2_ACCOUNT_ID,
        bucket: env.R2_BUCKET,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      })
    : undefined;
export const captureInbox = createDatabaseCaptureInbox(
  db,
  captureInboxWorkCreate,
  captureInboxMutationContract,
  env.NODE_ENV === "production"
    ? undefined
    : createDevelopmentCaptureInboxTriageAdapter(),
  webCaptureStaging
    ? createR2CaptureInboxStagingStore(webCaptureStaging)
    : undefined,
);
export const webCapture = createDatabaseWebCapture({
  captureInbox,
  database: db,
  projects: projectShell,
  securityEventDatabase: securityEventDb,
  staging: webCaptureStaging,
});
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

export function replaySecurityRevocations() {
  if (!securityReplay) {
    securityReplay = Promise.all([
      accountSessionAccess.replaySessionRevocations(),
      webCapture.replayRevocations(),
    ])
      .then(() => undefined)
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
