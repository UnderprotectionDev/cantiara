import type {
  AccountPreferences,
  AccountPreferencesAccess,
} from "@cantiara/api/account-preferences";
import type { CaptureInboxAccess } from "@cantiara/api/capture-triage";
import type {
  AccountAccessClient,
  AccountPreferencesCompatibilityAccess,
  Context as ApiContext,
  GitHubAvailability,
} from "@cantiara/api/context";
import type {
  CustomFieldMutationContracts,
  CustomFieldsAccess,
} from "@cantiara/api/custom-fields";
import { DESKTOP_API_CONTRACT_HEADER } from "@cantiara/api/desktop-api-window";
import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import type {
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type {
  PriorityMetricMutationContracts,
  PriorityMetricsAccess,
} from "@cantiara/api/priority-metrics";
import type {
  ProjectShellAccess,
  ProjectShellMutationContracts,
} from "@cantiara/api/project-shell";
import type { RecordActionsAccess } from "@cantiara/api/record-actions";
import type {
  RelationsAccess,
  UsageLinkMutationContracts,
  UsageLinksAccess,
} from "@cantiara/api/relations";
import type { TagMutationContracts, TagsAccess } from "@cantiara/api/tags";
import type { WebCaptureAccess } from "@cantiara/api/web-capture";
import type { WorkContextAccess } from "@cantiara/api/work-context";
import type { WorkDraftsAccess } from "@cantiara/api/work-drafts";
import type { WorkLifecycleAccess } from "@cantiara/api/work-lifecycle";
import type { WorkTemplatesAccess } from "@cantiara/api/work-templates";
import type { WorkspaceOverviewAccess } from "@cantiara/api/workspace-overview";
import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";
import type { Context as HonoContext } from "hono";
import { requestClientIp } from "./features/account-access/server/client-ip";
import type { GitHubIdentityConfirmation } from "./features/account-access/server/github-identity-confirmation";
import type { AccountSessionAccessRuntime } from "./features/account-access/server/session-access";

export type AccountAccessAuth = Pick<
  ReturnType<typeof createAuth>,
  "api" | "handler"
>;

export interface CreateContextOptions {
  accountPreferences: AccountPreferencesAccess;
  accountPreferencesCompatibility?: AccountPreferencesCompatibilityAccess;
  accountPreferencesMutationContract?: MutationContract<AccountPreferences>;
  accountSessionAccess: AccountSessionAccessRuntime;
  auth: AccountAccessAuth;
  captureInbox?: CaptureInboxAccess;
  context: HonoContext;
  customFieldMutationContracts?: CustomFieldMutationContracts;
  customFields?: CustomFieldsAccess;
  database: Database;
  fileAttachments?: FileAttachmentAccess;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
  mutationContract?: MutationContract<MutationPayload>;
  priorityMetricMutationContracts?: PriorityMetricMutationContracts;
  priorityMetrics?: PriorityMetricsAccess;
  projectShell?: ProjectShellAccess;
  projectShellMutationContracts?: ProjectShellMutationContracts;
  recordActions?: RecordActionsAccess;
  relations?: RelationsAccess;
  tagMutationContracts?: TagMutationContracts;
  tags?: TagsAccess;
  trustedProxyIps: readonly string[];
  usageLinkMutationContracts?: UsageLinkMutationContracts;
  usageLinks?: UsageLinksAccess;
  webCapture?: WebCaptureAccess;
  workContext?: WorkContextAccess;
  workDrafts?: WorkDraftsAccess;
  workLifecycle?: WorkLifecycleAccess;
  workspaceOverview?: WorkspaceOverviewAccess;
  workTemplates?: WorkTemplatesAccess;
}

export function requestClientPlatform(request: Request): AccountAccessClient {
  return request.headers.get("origin") === "http://tauri.localhost" ||
    request.headers.get("origin") === "tauri://localhost"
    ? "tauri"
    : "web";
}

export async function createContext({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  auth,
  captureInbox,
  customFields,
  customFieldMutationContracts,
  context,
  database,
  fileAttachments,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  priorityMetricMutationContracts,
  priorityMetrics,
  recordActions,
  workspaceOverview,
  tags,
  relations,
  tagMutationContracts,
  trustedProxyIps,
  usageLinkMutationContracts,
  usageLinks,
  webCapture,
  workContext,
  workDrafts,
  workLifecycle,
  workTemplates,
}: CreateContextOptions): Promise<ApiContext> {
  const candidateSession = await auth.api.getSession({
    headers: context.req.raw.headers,
    query: { disableRefresh: true },
  });
  const principal = candidateSession
    ? {
        accountId: candidateSession.user.id,
        sessionId: candidateSession.session.id,
      }
    : null;
  const authorized = principal
    ? await accountSessionAccess.authorizeWrite(principal)
    : false;
  const session = authorized ? candidateSession : null;
  return {
    accountAccess: accountSessionAccess,
    accountPreferences,
    accountPreferencesCompatibility,
    accountPreferencesMutationContract,
    clientKey: requestClientIp(context.req.raw, context, trustedProxyIps),
    clientPlatform: requestClientPlatform(context.req.raw),
    captureInbox,
    customFields,
    customFieldMutationContracts,
    desktopApiContract:
      context.req.raw.headers.get(DESKTOP_API_CONTRACT_HEADER) ?? undefined,
    db: database,
    fileAttachments,
    githubAvailability,
    githubIdentityConfirmation,
    mutationContract,
    projectShell,
    projectShellMutationContracts,
    priorityMetricMutationContracts,
    priorityMetrics,
    recordActions,
    workspaceOverview,
    tags,
    relations,
    auth: null,
    session,
    tagMutationContracts,
    usageLinkMutationContracts,
    usageLinks,
    webCapture,
    workContext,
    workDrafts,
    workLifecycle,
    workTemplates,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
