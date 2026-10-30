import type {
  AccountPreferences,
  AccountPreferencesAccess,
} from "@cantiara/api/account-preferences";
import type { AttentionSignalsAccess } from "@cantiara/api/attention-signals";
import type { PublicRoadmapReviewAccess } from "@cantiara/api/attention-signals-public-roadmap";
import type {
  BacklogAccess,
  BacklogMutationContracts,
} from "@cantiara/api/backlog";
import type { BuildInPublicAccess } from "@cantiara/api/build-in-public";
import type { CaptureInboxAccess } from "@cantiara/api/capture-triage";
import type {
  CompletionEffectsPreferences,
  CompletionEffectsPreferencesAccess,
} from "@cantiara/api/completion-effects";
import type { ContactsAccess } from "@cantiara/api/contacts";
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
import type { DailyFocusAccess } from "@cantiara/api/daily-focus";
import type { DataImportAccess } from "@cantiara/api/data-import";
import { DESKTOP_API_CONTRACT_HEADER } from "@cantiara/api/desktop-api-window";
import type { DocumentEvidenceAccess } from "@cantiara/api/document-evidence";
import type { DocumentTransfersAccess } from "@cantiara/api/document-transfer";
import type {
  DocumentMutationContracts,
  DocumentsAccess,
} from "@cantiara/api/documents";
import type { ExternalExecutionHandoffsAccess } from "@cantiara/api/external-handoffs";
import type { ExternalSurfaceManagementAccess } from "@cantiara/api/external-surface-management";
import type { FavoritesAccess } from "@cantiara/api/favorites";
import type { FeedbackAccess } from "@cantiara/api/feedback";
import type { FileAttachmentAccess } from "@cantiara/api/file-attachments";
import type { FocusPeriodAccess } from "@cantiara/api/focus-period";
import type { GitHubIntegrationAccess } from "@cantiara/api/github-integration";
import type { LinkSharingAccess } from "@cantiara/api/link-sharing";
import type { MoodboardSnapshotsAccess } from "@cantiara/api/moodboard-snapshot";
import type { PersonalMoodboardViewsAccess } from "@cantiara/api/moodboard-viewport";
import type {
  MoodboardMutationContracts,
  MoodboardsAccess,
} from "@cantiara/api/moodboards";
import type {
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type { PersonalRemindersAccess } from "@cantiara/api/personal-reminders";
import type { PlannedTestsAccess } from "@cantiara/api/planned-tests";
import type {
  PrioritizationSessionMutationContracts,
  PrioritizationSessionsAccess,
} from "@cantiara/api/prioritization-sessions";
import type {
  PriorityMetricMutationContracts,
  PriorityMetricsAccess,
} from "@cantiara/api/priority-metrics";
import type { ProductGapsAccess } from "@cantiara/api/product-gaps";
import type { ProductionIncidentsAccess } from "@cantiara/api/production-incidents";
import type { ProjectActivityAccess } from "@cantiara/api/project-activity";
import type { ProjectClosureSummaryAccess } from "@cantiara/api/project-closure-summary";
import type { ProjectGoalsAccess } from "@cantiara/api/project-goals";
import type { ProjectHistoryAccess } from "@cantiara/api/project-history";
import type { ProjectReleasePlanningAccess } from "@cantiara/api/project-release-planning";
import type {
  ProjectShellAccess,
  ProjectShellMutationContracts,
} from "@cantiara/api/project-shell";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import type { ProjectUpdatesAccess } from "@cantiara/api/project-updates";
import type { ProjectWallAccess } from "@cantiara/api/project-wall";
import type { RecordActionsAccess } from "@cantiara/api/record-actions";
import type {
  RecordTableAccess,
  UniversalSearchAccess,
} from "@cantiara/api/record-discovery";
import type {
  RelationsAccess,
  UsageLinkMutationContracts,
  UsageLinksAccess,
} from "@cantiara/api/relations";
import type { ReleaseCommunicationAccess } from "@cantiara/api/release-communication";
import type { ReleaseEvidenceAccess } from "@cantiara/api/release-evidence";
import type { ResearchSessionsAccess } from "@cantiara/api/research-sessions";
import type { ReturnToWorkAccess } from "@cantiara/api/return-to-work";
import type { RoadmapHorizonAccess } from "@cantiara/api/roadmap-horizon";
import type { SchemaArtifactsAccess } from "@cantiara/api/schema-artifacts";
import type { ScreensAccess } from "@cantiara/api/screens";
import type { SmartCollectionsAccess } from "@cantiara/api/smart-collections";
import type { SmartLinkPreviewAccess } from "@cantiara/api/smart-link-preview";
import type { SourceEvidenceAccess } from "@cantiara/api/source-evidence";
import type { SourceRecheckAccess } from "@cantiara/api/source-recheck";
import type { SourcesAndFreshnessAccess } from "@cantiara/api/sources-and-freshness";
import type { SpecChangeReviewAccess } from "@cantiara/api/spec-change-review";
import type { SpecChangeReviewMutationContracts } from "@cantiara/api/spec-change-review-candidates";
import type { TagMutationContracts, TagsAccess } from "@cantiara/api/tags";
import type { TechnicalDiagramsAccess } from "@cantiara/api/technical-diagrams";
import type { TestAssessmentsAccess } from "@cantiara/api/test-assessments";
import type { TestGapsAccess } from "@cantiara/api/test-gaps";
import type { TestReportAcceptanceAccess } from "@cantiara/api/test-report";
import type { TestReviewAccess } from "@cantiara/api/test-review";
import type { TrashAccess } from "@cantiara/api/trash";
import type { UserFlowAccess } from "@cantiara/api/user-flow";
import type { ValueChainAccess } from "@cantiara/api/value-chain";
import type { WebCaptureAccess } from "@cantiara/api/web-capture";
import type { WikiPublishingAccess } from "@cantiara/api/wiki-publishing";
import type { WorkAutomationAccess } from "@cantiara/api/work-automation";
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
  attentionSignals?: AttentionSignalsAccess;
  auth: AccountAccessAuth;
  backlog?: BacklogAccess;
  backlogMutationContracts?: BacklogMutationContracts;
  buildInPublic?: BuildInPublicAccess;
  captureInbox?: CaptureInboxAccess;
  completionEffectsPreferences?: CompletionEffectsPreferencesAccess;
  completionEffectsPreferencesMutationContract?: MutationContract<CompletionEffectsPreferences>;
  contacts?: ContactsAccess;
  context: HonoContext;
  customFieldMutationContracts?: CustomFieldMutationContracts;
  customFields?: CustomFieldsAccess;
  dailyFocus?: DailyFocusAccess;
  database: Database;
  dataImport?: DataImportAccess;
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
  githubIdentityConfirmation?: GitHubIdentityConfirmation;
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
  trustedProxyIps: readonly string[];
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
  backlog,
  backlogMutationContracts,
  dailyFocus,
  favorites,
  returnToWork,
  documentMutationContracts,
  documents,
  documentTransfers,
  smartCollections,
  moodboardMutationContracts,
  moodboardPersonalViews,
  moodboardSnapshots,
  moodboards,
  schemaArtifacts,
  technicalDiagrams,
  projectWall,
  userFlow,
  universalSearch,
  focusPeriod,
  roadmapHorizon,
  captureInbox,
  completionEffectsPreferences,
  completionEffectsPreferencesMutationContract,
  customFields,
  customFieldMutationContracts,
  context,
  database,
  fileAttachments,
  workHandoffs,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  projectGoals,
  projectReleasePlanning,
  productionIncidents,
  projectSourceRecords,
  documentEvidence,
  sourceEvidence,
  sourceRecheck,
  sourcesAndFreshness,
  smartLinkPreview,
  researchSessions,
  recordTable,
  priorityMetricMutationContracts,
  priorityMetrics,
  prioritizationSessionMutationContracts,
  prioritizationSessions,
  personalReminders,
  recordActions,
  releaseCommunication,
  workAutomation,
  buildInPublic,
  externalSurfaceManagement,
  wikiPublishing,
  workspaceOverview,
  tags,
  contacts,
  feedback,
  screens,
  plannedTests,
  testGaps,
  testReview,
  productGaps,
  testReports,
  testAssessments,
  gitHubIntegration,
  specChangeReview,
  specChangeReviewMutationContracts,
  projectActivity,
  relations,
  attentionSignals,
  publicRoadmapReview,
  releaseEvidence,
  projectHistory,
  projectUpdates,
  trash,
  dataImport,
  linkSharing,
  projectClosureSummary,
  valueChain,
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
    backlog,
    backlogMutationContracts,
    dailyFocus,
    favorites,
    returnToWork,
    documentMutationContracts,
    documents,
    documentTransfers,
    smartCollections,
    moodboardMutationContracts,
    moodboardPersonalViews,
    moodboardSnapshots,
    moodboards,
    schemaArtifacts,
    technicalDiagrams,
    projectWall,
    userFlow,
    universalSearch,
    focusPeriod,
    roadmapHorizon,
    clientKey: requestClientIp(context.req.raw, context, trustedProxyIps),
    clientPlatform: requestClientPlatform(context.req.raw),
    captureInbox,
    completionEffectsPreferences,
    completionEffectsPreferencesMutationContract,
    customFields,
    customFieldMutationContracts,
    desktopApiContract:
      context.req.raw.headers.get(DESKTOP_API_CONTRACT_HEADER) ?? undefined,
    db: database,
    fileAttachments,
    workHandoffs,
    githubAvailability,
    githubIdentityConfirmation,
    mutationContract,
    projectShell,
    projectShellMutationContracts,
    projectGoals,
    projectReleasePlanning,
    productionIncidents,
    projectSourceRecords,
    documentEvidence,
    sourceEvidence,
    sourceRecheck,
    sourcesAndFreshness,
    smartLinkPreview,
    researchSessions,
    recordTable,
    priorityMetricMutationContracts,
    priorityMetrics,
    prioritizationSessionMutationContracts,
    prioritizationSessions,
    personalReminders,
    recordActions,
    releaseCommunication,
    workAutomation,
    buildInPublic,
    externalSurfaceManagement,
    wikiPublishing,
    workspaceOverview,
    tags,
    contacts,
    feedback,
    screens,
    plannedTests,
    testGaps,
    testReview,
    productGaps,
    testReports,
    testAssessments,
    gitHubIntegration,
    specChangeReview,
    specChangeReviewMutationContracts,
    projectActivity,
    relations,
    attentionSignals,
    publicRoadmapReview,
    releaseEvidence,
    projectHistory,
    projectUpdates,
    trash,
    dataImport,
    linkSharing,
    projectClosureSummary,
    valueChain,
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
