import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";

import type {
  AccountPreferences,
  AccountPreferencesAccess,
  AccountPreferencesSnapshot,
  Appearance,
} from "./account-preferences";
import type { CaptureInboxAccess } from "./capture-triage";
import type {
  CustomFieldMutationContracts,
  CustomFieldsAccess,
} from "./custom-fields";
import type { FileAttachmentAccess } from "./file-attachments";
import type { MutationContract, MutationPayload } from "./mutation-and-undo";
import type {
  ProjectShellAccess,
  ProjectShellMutationContracts,
} from "./project-shell";
import type {
  RelationsAccess,
  UsageLinkMutationContracts,
  UsageLinksAccess,
} from "./relations";
import type { TagMutationContracts, TagsAccess } from "./tags";
import type { WebCaptureAccess } from "./web-capture";
import type { WorkContextAccess } from "./work-context";
import type { WorkDraftsAccess } from "./work-drafts";
import type { WorkLifecycleAccess } from "./work-lifecycle";
import type { WorkspaceOverviewAccess } from "./workspace-overview";

export interface AccountSessionPrincipal {
  accountId: string;
  sessionId: string;
}

export type AccountAccessClient = "web" | "tauri";

export const TAURI_CONFIRM_GITHUB_IDENTITY_CALLBACK_URL =
  "cantiara://auth/confirm-github-identity";
export const CONFIRM_GITHUB_IDENTITY_HANDOFF_EXCHANGE_PATH =
  "/api/auth/confirm-github-identity/exchange";

export const CONFIRM_GITHUB_IDENTITY_OPERATION_IDS = [
  "account-closure-start",
  "account-closure-cancel",
  "security-redaction",
  "early-permanent-delete",
  "personal-data-erase",
] as const;

export type ConfirmGitHubIdentityOperationId =
  (typeof CONFIRM_GITHUB_IDENTITY_OPERATION_IDS)[number];

export type GitHubIdentityConfirmationStartResult =
  | { authorizationUrl: string }
  | { status: "waiting" };

export interface GitHubIdentityConfirmationAccess {
  consume: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    grant: string,
    clientKey?: string,
  ) => Promise<boolean>;
  exchange: (
    principal: AccountSessionPrincipal,
    handoffCode: string,
    clientKey?: string,
  ) => Promise<string | null>;
  start: (
    principal: AccountSessionPrincipal,
    operationId: ConfirmGitHubIdentityOperationId,
    clientKey?: string,
    clientPlatform?: AccountAccessClient,
  ) => Promise<GitHubIdentityConfirmationStartResult | null>;
}

export type GitHubAvailabilityStatus = "available" | "waiting";

export interface GitHubAvailability {
  getStatus: () => GitHubAvailabilityStatus;
}

export interface AccountSessionSummary {
  current: boolean;
  device: string;
  id: string;
  lastActivityAt: string;
}

export interface AccountPreferencesCompatibilityAccess {
  save: (
    accountId: string,
    preferences: AccountPreferences,
  ) => Promise<AccountPreferencesSnapshot>;
  saveAppearance: (
    accountId: string,
    appearance: Appearance,
  ) => Promise<AccountPreferencesSnapshot>;
}

export interface AccountSessionAccess {
  listSessions: (
    principal: AccountSessionPrincipal,
  ) => Promise<AccountSessionSummary[]>;
  revokeOtherSessions: (principal: AccountSessionPrincipal) => Promise<void>;
  revokeSession: (
    principal: AccountSessionPrincipal,
    targetSessionAlias: string,
  ) => Promise<void>;
}

export interface Context {
  accountAccess: AccountSessionAccess;
  accountPreferences: AccountPreferencesAccess;
  accountPreferencesCompatibility?: AccountPreferencesCompatibilityAccess;
  accountPreferencesMutationContract?: MutationContract<AccountPreferences>;
  auth: null;
  captureInbox?: CaptureInboxAccess;
  clientKey?: string;
  clientPlatform?: AccountAccessClient;
  customFieldMutationContracts?: CustomFieldMutationContracts;
  customFields?: CustomFieldsAccess;
  db: Database;
  desktopApiContract?: string;
  fileAttachments?: FileAttachmentAccess;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmationAccess;
  mutationContract?: MutationContract<MutationPayload>;
  projectShell?: ProjectShellAccess;
  projectShellMutationContracts?: ProjectShellMutationContracts;
  relations?: RelationsAccess;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
  >;
  tagMutationContracts?: TagMutationContracts;
  tags?: TagsAccess;
  usageLinkMutationContracts?: UsageLinkMutationContracts;
  usageLinks?: UsageLinksAccess;
  webCapture?: WebCaptureAccess;
  workContext?: WorkContextAccess;
  workDrafts?: WorkDraftsAccess;
  workLifecycle?: WorkLifecycleAccess;
  workspaceOverview?: WorkspaceOverviewAccess;
}
