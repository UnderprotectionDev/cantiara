import type { createAuth } from "@cantiara/auth";
import type { Database } from "@cantiara/db";
import type {
  AccountPreferences,
  AccountPreferencesAccess,
  AccountPreferencesSnapshot,
  Appearance,
} from "./account-preferences";
import type { AttentionSignalsAccess } from "./attention-signals";
import type { PublicRoadmapReviewAccess } from "./attention-signals-public-roadmap";
import type { BacklogAccess, BacklogMutationContracts } from "./backlog";
import type { BuildInPublicAccess } from "./build-in-public";
import type { CaptureInboxAccess } from "./capture-triage";
import type {
  CompletionEffectsPreferences,
  CompletionEffectsPreferencesAccess,
} from "./completion-effects";
import type { ContactsAccess } from "./contacts";
import type {
  CustomFieldMutationContracts,
  CustomFieldsAccess,
} from "./custom-fields";
import type { DailyFocusAccess } from "./daily-focus";
import type { SelectedExportAccess } from "./data-export";
import type { DocumentEvidenceAccess } from "./document-evidence";
import type { DocumentTransfersAccess } from "./document-transfer";
import type { DocumentMutationContracts, DocumentsAccess } from "./documents";
import type { ExternalExecutionHandoffsAccess } from "./external-handoffs";
import type { ExternalSurfaceManagementAccess } from "./external-surface-management";
import type { FavoritesAccess } from "./favorites";
import type { FeedbackAccess } from "./feedback";
import type { FileAttachmentAccess } from "./file-attachments";
import type { FocusPeriodAccess } from "./focus-period";
import type { GitHubIntegrationAccess } from "./github-integration";
import type { LinkSharingAccess } from "./link-sharing";
import type { MoodboardSnapshotsAccess } from "./moodboard-snapshot";
import type { PersonalMoodboardViewsAccess } from "./moodboard-viewport";
import type {
  MoodboardMutationContracts,
  MoodboardsAccess,
} from "./moodboards";
import type { MutationContract, MutationPayload } from "./mutation-and-undo";
import type { PersonalRemindersAccess } from "./personal-reminders";
import type { PlannedTestsAccess } from "./planned-tests";
import type {
  PrioritizationSessionMutationContracts,
  PrioritizationSessionsAccess,
} from "./prioritization-sessions";
import type {
  PriorityMetricMutationContracts,
  PriorityMetricsAccess,
} from "./priority-metrics";
import type { ProductGapsAccess } from "./product-gaps";
import type { ProductionIncidentsAccess } from "./production-incidents";
import type { ProjectActivityAccess } from "./project-activity";
import type { ProjectClosureSummaryAccess } from "./project-closure-summary";
import type { ProjectGoalsAccess } from "./project-goals";
import type { ProjectHistoryAccess } from "./project-history";
import type { ProjectReleasePlanningAccess } from "./project-release-planning";
import type {
  ProjectShellAccess,
  ProjectShellMutationContracts,
} from "./project-shell";
import type { ProjectSourceRecordsAccess } from "./project-source-records";
import type { ProjectUpdatesAccess } from "./project-updates";
import type { ProjectWallAccess } from "./project-wall";
import type { RecordActionsAccess } from "./record-actions";
import type {
  RecordTableAccess,
  UniversalSearchAccess,
} from "./record-discovery";
import type {
  RelationsAccess,
  UsageLinkMutationContracts,
  UsageLinksAccess,
} from "./relations";
import type { ReleaseCommunicationAccess } from "./release-communication";
import type { ReleaseEvidenceAccess } from "./release-evidence";
import type { ResearchSessionsAccess } from "./research-sessions";
import type { ReturnToWorkAccess } from "./return-to-work";
import type { RoadmapHorizonAccess } from "./roadmap-horizon";
import type { SchemaArtifactsAccess } from "./schema-artifacts";
import type { ScreensAccess } from "./screens";
import type { SecurityRedactionAccess } from "./security-redaction";
import type { SmartCollectionsAccess } from "./smart-collections";
import type { SmartLinkPreviewAccess } from "./smart-link-preview";
import type { SourceEvidenceAccess } from "./source-evidence";
import type { SourceRecheckAccess } from "./source-recheck";
import type { SourcesAndFreshnessAccess } from "./sources-and-freshness";
import type { SpecChangeReviewAccess } from "./spec-change-review";
import type { SpecChangeReviewMutationContracts } from "./spec-change-review-candidates";
import type { TagMutationContracts, TagsAccess } from "./tags";
import type { TechnicalDiagramsAccess } from "./technical-diagrams";
import type { TestAssessmentsAccess } from "./test-assessments";
import type { TestGapsAccess } from "./test-gaps";
import type { TestReportAcceptanceAccess } from "./test-report";
import type { TestReviewAccess } from "./test-review";
import type { TrashAccess } from "./trash";
import type { UserFlowAccess } from "./user-flow";
import type { ValueChainAccess } from "./value-chain";
import type { WebCaptureAccess } from "./web-capture";
import type { WikiPublishingAccess } from "./wiki-publishing";
import type { WorkAutomationAccess } from "./work-automation";
import type { WorkContextAccess } from "./work-context";
import type { WorkDraftsAccess } from "./work-drafts";
import type { WorkLifecycleAccess } from "./work-lifecycle";
import type { WorkTemplatesAccess } from "./work-templates";
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
  attentionSignals?: AttentionSignalsAccess;
  auth: null;
  backlog?: BacklogAccess;
  backlogMutationContracts?: BacklogMutationContracts;
  buildInPublic?: BuildInPublicAccess;
  captureInbox?: CaptureInboxAccess;
  clientKey?: string;
  clientPlatform?: AccountAccessClient;
  completionEffectsPreferences?: CompletionEffectsPreferencesAccess;
  completionEffectsPreferencesMutationContract?: MutationContract<CompletionEffectsPreferences>;
  contacts?: ContactsAccess;
  customFieldMutationContracts?: CustomFieldMutationContracts;
  customFields?: CustomFieldsAccess;
  dailyFocus?: DailyFocusAccess;
  db: Database;
  desktopApiContract?: string;
  documentEvidence?: DocumentEvidenceAccess;
  documentMutationContracts?: DocumentMutationContracts;
  documents?: DocumentsAccess;
  documentTransfers?: DocumentTransfersAccess;
  externalSurfaceManagement?: ExternalSurfaceManagementAccess;
  favorites?: FavoritesAccess;
  feedback?: FeedbackAccess;
  fileAttachments?: FileAttachmentAccess;
  focusPeriod?: FocusPeriodAccess;
  gitHubIntegration?: GitHubIntegrationAccess;
  githubAvailability: GitHubAvailability;
  githubIdentityConfirmation?: GitHubIdentityConfirmationAccess;
  linkSharing?: LinkSharingAccess;
  moodboardMutationContracts?: MoodboardMutationContracts;
  moodboardPersonalViews?: PersonalMoodboardViewsAccess;
  moodboardSnapshots?: MoodboardSnapshotsAccess;
  moodboards?: MoodboardsAccess;
  mutationContract?: MutationContract<MutationPayload>;
  personalReminders?: PersonalRemindersAccess;
  plannedTests?: PlannedTestsAccess;
  prioritizationSessionMutationContracts?: PrioritizationSessionMutationContracts;
  prioritizationSessions?: PrioritizationSessionsAccess;
  priorityMetricMutationContracts?: PriorityMetricMutationContracts;
  priorityMetrics?: PriorityMetricsAccess;
  productGaps?: ProductGapsAccess;
  productionIncidents?: ProductionIncidentsAccess;
  projectActivity?: ProjectActivityAccess;
  projectClosureSummary?: ProjectClosureSummaryAccess;
  projectGoals?: ProjectGoalsAccess;
  projectHistory?: ProjectHistoryAccess;
  projectReleasePlanning?: ProjectReleasePlanningAccess;
  projectShell?: ProjectShellAccess;
  projectShellMutationContracts?: ProjectShellMutationContracts;
  projectSourceRecords?: ProjectSourceRecordsAccess;
  projectUpdates?: ProjectUpdatesAccess;
  projectWall?: ProjectWallAccess;
  publicRoadmapReview?: PublicRoadmapReviewAccess;
  recordActions?: RecordActionsAccess;
  recordTable?: RecordTableAccess;
  relations?: RelationsAccess;
  releaseCommunication?: ReleaseCommunicationAccess;
  releaseEvidence?: ReleaseEvidenceAccess;
  researchSessions?: ResearchSessionsAccess;
  returnToWork?: ReturnToWorkAccess;
  roadmapHorizon?: RoadmapHorizonAccess;
  schemaArtifacts?: SchemaArtifactsAccess;
  screens?: ScreensAccess;
  securityRedaction?: SecurityRedactionAccess;
  selectedExport?: SelectedExportAccess;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
  >;
  smartCollections?: SmartCollectionsAccess;
  smartLinkPreview?: SmartLinkPreviewAccess;
  sourceEvidence?: SourceEvidenceAccess;
  sourceRecheck?: SourceRecheckAccess;
  sourcesAndFreshness?: SourcesAndFreshnessAccess;
  specChangeReview?: SpecChangeReviewAccess;
  specChangeReviewMutationContracts?: SpecChangeReviewMutationContracts;
  tagMutationContracts?: TagMutationContracts;
  tags?: TagsAccess;
  technicalDiagrams?: TechnicalDiagramsAccess;
  testAssessments?: TestAssessmentsAccess;
  testGaps?: TestGapsAccess;
  testReports?: TestReportAcceptanceAccess;
  testReview?: TestReviewAccess;
  trash?: TrashAccess;
  universalSearch?: UniversalSearchAccess;
  usageLinkMutationContracts?: UsageLinkMutationContracts;
  usageLinks?: UsageLinksAccess;
  userFlow?: UserFlowAccess;
  valueChain?: ValueChainAccess;
  webCapture?: WebCaptureAccess;
  wikiPublishing?: WikiPublishingAccess;
  workAutomation?: WorkAutomationAccess;
  workContext?: WorkContextAccess;
  workDrafts?: WorkDraftsAccess;
  workHandoffs?: ExternalExecutionHandoffsAccess;
  workLifecycle?: WorkLifecycleAccess;
  workspaceOverview?: WorkspaceOverviewAccess;
  workTemplates?: WorkTemplatesAccess;
}
