import { createHash } from "node:crypto";
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { CompletionEffectsPreferences } from "@cantiara/api/completion-effects";
import {
  createExternalSurfaceAccess,
  createMemoryExternalSurfaceResponseCache,
} from "@cantiara/api/external-surface-access";
import { createDatabaseExternalSurfaceStateReader } from "@cantiara/api/external-surface-access-database";
import type { LinkSharingRootKind } from "@cantiara/api/link-sharing";
import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import { createDatabaseMutationContract } from "@cantiara/api/mutation-contract-database";
import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";
import { connectDisposable } from "@cantiara/db/disposable-connection";
import {
  createLocalSecurityEventDb,
  createSecurityEventDb,
} from "@cantiara/db/security-events";
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
import { createDatabaseAttentionSignals } from "./features/attention-signals/server/attention-signals-database";
import { createDatabasePublicRoadmapReview } from "./features/attention-signals/server/public-roadmap-review-database";
import { createBacklogAccess } from "./features/backlog/server/backlog";
import { createDatabaseBacklog } from "./features/backlog/server/backlog-database";
import { createDatabaseBacklogMutationContracts } from "./features/backlog/server/backlog-mutation-database";
import { createBacklogReappearSignalWorker } from "./features/backlog/server/backlog-reappear-signal-worker";
import { sweepDueReappearSignals as sweepBacklogSignals } from "./features/backlog/server/backlog-reappear-signals";
import { createDatabaseBuildInPublic } from "./features/build-in-public/server/build-in-public-database";
import { createBuildInPublicRoutes } from "./features/build-in-public/server/build-in-public-http";
import {
  createDatabaseBuildInPublicAssets,
  createDatabaseBuildInPublicSlugs,
  createDatabaseBuildInPublicSnapshots,
  createDatabaseBuildInPublicViewer,
} from "./features/build-in-public/server/build-in-public-public-database";
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
import {
  completionEffectsPreferencesMutationTarget,
  createDatabaseCompletionEffectsPreferences,
} from "./features/completion-effects/server/completion-effects-database";
import { createDatabaseContacts } from "./features/contacts/server/contacts-database";
import { createDatabaseCustomFields } from "./features/custom-fields/server/custom-fields-database";
import {
  createDatabaseCustomFieldFinalizationWriter,
  createDatabaseCustomFieldMutationContracts,
} from "./features/custom-fields/server/custom-fields-mutation-database";
import { createDatabaseDailyFocus } from "./features/daily-focus/server/daily-focus-database";
import { createDatabaseDocumentSurfaceCancellations } from "./features/documents/server/document-surface-cancellations";
import { createDatabaseDocumentTagRenameWriter } from "./features/documents/server/document-tag-rename-database";
import { createDatabaseDocumentTransfers } from "./features/documents/server/document-transfers-database";
import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "./features/documents/server/documents-database";
import { insertWorkWithKeyAllocation } from "./features/evidence/server/evidence-record-creation";
import { createDatabaseExternalExecutionHandoffs } from "./features/external-handoffs/server/external-handoffs-database";
import { createExternalSurfaceManagement } from "./features/external-surface-management/server/external-surface-management";
import { createDatabaseSurfaceDirectory } from "./features/external-surface-management/server/external-surface-management-database";
import { createSurfacePurges } from "./features/external-surface-management/server/external-surface-purge";
import { createDatabaseSurfacePurges } from "./features/external-surface-management/server/external-surface-purge-database";
import { createDatabaseFavorites } from "./features/favorites/server/favorites-database";
import { createDatabaseFeedbackWithFeed } from "./features/feedback/server/feedback-feed-database";
import { createFileAttachmentLocationWork } from "./features/file-attachments/server/file-attachment-location-work";
import type { FileAttachmentPreviewProcessOptions } from "./features/file-attachments/server/file-attachment-preview";
import { createFileAttachmentPreviewWorker } from "./features/file-attachments/server/file-attachment-preview-queue";
import { createFileAttachments } from "./features/file-attachments/server/file-attachments";
import { createDatabaseFileAttachments } from "./features/file-attachments/server/file-attachments-database";
import { createFileAttachmentObjectStore } from "./features/file-attachments/server/file-attachments-object-store";
import { createDatabaseFocusPeriod } from "./features/focus-period/server/focus-period-database";
import { createConfiguredGitHubIntegration } from "./features/github-integration/server/github-integration-configured";
import { createGitHubWebhookWorker } from "./features/github-integration/server/github-webhook-worker";
import { createLinkSharingAssets } from "./features/link-sharing/server/link-sharing-assets";
import { createDatabaseLinkSharingAudit } from "./features/link-sharing/server/link-sharing-audit-database";
import {
  createDatabaseLinkSharing,
  createDatabaseLinkSharingReplay,
} from "./features/link-sharing/server/link-sharing-database";
import { createDatabaseLinkSharingSecurityEvents } from "./features/link-sharing/server/link-sharing-security-events";
import {
  createDatabaseLinkSharingVisitor,
  purgeLinkSharingVisitorData,
} from "./features/link-sharing/server/link-sharing-visitor-database";
import { createDatabaseMoodboardPersonalViews } from "./features/moodboards/server/moodboard-personal-views-database";
import { createDatabaseMoodboardSnapshots } from "./features/moodboards/server/moodboard-snapshots-database";
import { createDatabaseMoodboards } from "./features/moodboards/server/moodboards-database";
import { createDatabaseMoodboardMutationContracts } from "./features/moodboards/server/moodboards-mutation-database";
import { createPersonalReminderWorker } from "./features/personal-reminders/server/personal-reminder-worker";
import { createDatabasePersonalReminders } from "./features/personal-reminders/server/personal-reminders-database";
import { createDatabasePlannedTests } from "./features/planned-tests/server/planned-tests-database";
import { createPrioritizationSessionsAccess } from "./features/prioritization-sessions/server/prioritization-sessions";
import { createDatabasePrioritizationSessions } from "./features/prioritization-sessions/server/prioritization-sessions-database";
import { createDatabasePrioritizationSessionMutationContracts } from "./features/prioritization-sessions/server/prioritization-sessions-mutation-database";
import { createPriorityMetricsAccess } from "./features/priority-metrics/server/priority-metrics";
import { createDatabasePriorityMetrics } from "./features/priority-metrics/server/priority-metrics-database";
import { createDatabasePriorityMetricMutationContracts } from "./features/priority-metrics/server/priority-metrics-mutation-database";
import {
  createDatabasePriorityMetricPermanentDeleteEvents,
  createDatabasePriorityMetricTrashMaintenance,
} from "./features/priority-metrics/server/priority-metrics-trash-database";
import { createDatabaseProductGaps } from "./features/product-gaps/server/product-gaps-database";
import { createDatabaseProjectClosureSummary } from "./features/project-closure-summary/server/project-closure-summary-database";
import { createDatabaseProjectGoals } from "./features/project-goals/server/project-goals-database";
import { createProjectActivity } from "./features/project-history/server/project-activity";
import { createDatabaseProjectActivityStore } from "./features/project-history/server/project-activity-database";
import { createDatabaseProjectHistory } from "./features/project-history/server/project-history-database";
import { createDatabaseProjectShell } from "./features/project-shell/server/project-shell-database";
import { createDatabaseProjectShellMutationContracts } from "./features/project-shell/server/project-shell-mutation-database";
import { createDatabaseProjectSourceRecords } from "./features/project-source-records/server/project-source-records-database";
import { createDatabaseProjectWall } from "./features/project-wall/server/project-wall-database";
import { playwrightProjectWallSnapshotRenderer } from "./features/project-wall/server/project-wall-snapshot-render";
import { createDatabaseRecordActions } from "./features/record-actions/server/record-actions-database";
import { createDatabaseRecordTable } from "./features/record-discovery/server/record-table-database";
import { createDatabaseUniversalSearch } from "./features/record-discovery/server/universal-search-database";
import { createDatabaseRelations } from "./features/relations/server/relations";
import {
  createDatabaseUsageLinkMutationContracts,
  createDatabaseUsageLinks,
} from "./features/relations/server/usage-links-database";
import {
  createDatabaseReleaseCommunication,
  createLookAgainSchedule,
} from "./features/release-communication/server/release-communication-database";
import { createDatabaseReleaseEvidence } from "./features/release-evidence/server/release-evidence-database";
import {
  createDatabaseResearchSessions,
  sweepExpiredResearchBindingPreviews,
} from "./features/research-sessions/server/research-sessions-database";
import { createDatabaseReturnToWork } from "./features/return-to-work/server/return-to-work-database";
import { createDatabaseRoadmapHorizon } from "./features/roadmap-horizon/server/roadmap-horizon-database";
import { createNeonDisposableDatabase } from "./features/schema-artifacts/server/neon-disposable-database";
import { createSchemaArtifacts } from "./features/schema-artifacts/server/schema-artifacts";
import { createDatabaseMigrationArtifacts } from "./features/schema-artifacts/server/schema-artifacts-database";
import { createDatabaseScreens } from "./features/screens/server/screens-database";
import { createSecurityRedaction } from "./features/security-redaction/server/security-redaction";
import { createSmartCollectionSubscriptionSignalWorker } from "./features/smart-collections/server/smart-collection-subscription-signal-worker";
import {
  createDatabaseSmartCollections,
  sweepSmartCollectionSubscriptionSignals,
} from "./features/smart-collections/server/smart-collections-database";
import { createDatabaseSourcesAndFreshness } from "./features/sources-and-freshness/server/sources-database";
import { createSpecChangeReview } from "./features/spec-change-review/server/spec-change-review";
import { createDatabaseSpecChangeReviewStore } from "./features/spec-change-review/server/spec-change-review-database";
import { createDatabaseSpecChangeReviewMutationContracts } from "./features/spec-change-review/server/spec-change-review-mark-database";
import {
  createDatabaseTagMutationContracts,
  createDatabaseTags,
} from "./features/tags/server/tags-database";
import { createDatabaseTechnicalDiagrams } from "./features/technical-diagrams/server/technical-diagrams-database";
import { createDatabaseTestAssessments } from "./features/test-assessments/server/test-assessments-database";
import { createDatabaseTestGaps } from "./features/test-gaps/server/test-gaps-database";
import { createDatabaseTestReports } from "./features/test-report/server/test-report-database";
import { createDatabaseTestReview } from "./features/test-review/server/test-review-database";
import { createDatabaseTrash } from "./features/trash/server/trash-database";
import { createDatabaseTrashEarlyDelete } from "./features/trash/server/trash-early-delete-database";
import { createTrashMaintenance } from "./features/trash/server/trash-expiry";
import {
  createDatabaseTrashEventLog,
  createDatabaseTrashExpiry,
} from "./features/trash/server/trash-expiry-database";
import { createDatabaseTrashSurfaces } from "./features/trash/server/trash-surfaces-database";
import { createDatabaseUserFlow } from "./features/user-flow/server/user-flow-database";
import { createDatabaseValueChain } from "./features/value-chain/server/value-chain-database";
import {
  createDatabaseWikiPublicAssets,
  createDatabaseWikiPublicSnapshots,
  createDatabaseWikiPublishing,
} from "./features/wiki-publishing/server/wiki-publishing-database";
import { createWikiPublicRoutes } from "./features/wiki-publishing/server/wiki-publishing-http";
import {
  createDatabaseWorkAutomation,
  type WorkAutomationWorkCreation,
} from "./features/work-automation/server/work-automation-database";
import { withWorkAutomationEvents } from "./features/work-automation/server/work-automation-events";
import { createWorkContextAccess } from "./features/work-context/server/work-context";
import { createDatabaseWorkDrafts } from "./features/work-drafts/server/work-drafts-database";
import {
  createDatabaseWorkLifecycle,
  toWorkProfile,
} from "./features/work-lifecycle/server/work-lifecycle-database";
import { createDatabaseWorkTemplates } from "./features/work-templates/server/work-templates-database";
import { createDatabaseWorkspaceOverview } from "./features/workspace-overview/server/workspace-overview-database";
import { createMaintenanceWorker } from "./maintenance-worker";
import { createProductionIncidents } from "./production-incidents-wiring";
import { createProjectReleasePlanning } from "./project-release-planning-wiring";
import { createProjectUpdatesService } from "./project-updates-wiring";

const db = createDb(env);
export const documents = createDatabaseDocuments(db);
export const smartCollections = createDatabaseSmartCollections(db);
const smartCollectionSubscriptionSignalWorker =
  createSmartCollectionSubscriptionSignalWorker({
    connectionString: env.DATABASE_URL,
    // The sweep intentionally reconciles every subscription; membership transitions are
    // only discoverable by recomputing each collection's live result, not by a due time.
    process: () => sweepSmartCollectionSubscriptionSignals(db),
  });
export const startSmartCollectionSubscriptionSignalWorker =
  smartCollectionSubscriptionSignalWorker.start;
export const stopSmartCollectionSubscriptionSignalWorker =
  smartCollectionSubscriptionSignalWorker.stop;
export const technicalDiagrams = createDatabaseTechnicalDiagrams(db);
export const schemaArtifacts = createSchemaArtifacts({
  validator:
    env.NEON_API_KEY &&
    env.NEON_VALIDATION_PROJECT_ID &&
    env.NEON_VALIDATION_BRANCH_ID
      ? createNeonDisposableDatabase(
          {
            apiKey: env.NEON_API_KEY,
            branchId: env.NEON_VALIDATION_BRANCH_ID,
            projectId: env.NEON_VALIDATION_PROJECT_ID,
          },
          { connect: connectDisposable },
        )
      : undefined,
  store: createDatabaseMigrationArtifacts(db),
  versions: technicalDiagrams,
});
export const userFlow = createDatabaseUserFlow(db);
export const moodboards = createDatabaseMoodboards(db);
export const moodboardPersonalViews = createDatabaseMoodboardPersonalViews(db);
export const moodboardMutationContracts =
  createDatabaseMoodboardMutationContracts(db);
export const universalSearch = createDatabaseUniversalSearch(db);
export const documentMutationContracts =
  createDatabaseDocumentMutationContracts(db);
export const favorites = createDatabaseFavorites(db);
export const dailyFocus = createDatabaseDailyFocus(db);
export const focusPeriod = createDatabaseFocusPeriod(db);
export const projectGoals = createDatabaseProjectGoals(db);
export const projectReleasePlanning = createProjectReleasePlanning(db);
export const productionIncidents = createProductionIncidents(db);
export const researchSessions = createDatabaseResearchSessions(db);
export const projectSourceRecords = createDatabaseProjectSourceRecords(db);
export const sourcesAndFreshness = createDatabaseSourcesAndFreshness(db);
const securityEventDb =
  env.SECURITY_EVENT_LOCAL === "true"
    ? await createLocalSecurityEventDb({
        DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
        proxyAddress: env.NEON_LOCAL_PROXY,
      })
    : createSecurityEventDb({
        DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
      });
const priorityMetricPermanentDeleteEvents =
  createDatabasePriorityMetricPermanentDeleteEvents(securityEventDb);
export const documentTransfers = createDatabaseDocumentTransfers(
  db,
  documents,
  createDatabaseDocumentSurfaceCancellations(securityEventDb),
);
const priorityMetricTrashMaintenance =
  createDatabasePriorityMetricTrashMaintenance(
    db,
    priorityMetricPermanentDeleteEvents,
  );
const accountAdmission = createDatabaseAccountAdmission(db);
const databaseAccountPreferences = createDatabaseAccountPreferences(db);
export const accountPreferences = databaseAccountPreferences;
export const accountPreferencesCompatibility = databaseAccountPreferences;
export const accountPreferencesMutationContract =
  createDatabaseMutationContract<AccountPreferences>(db, {
    target: accountPreferencesMutationTarget,
  });
export const completionEffectsPreferences =
  createDatabaseCompletionEffectsPreferences(db);
export const completionEffectsPreferencesMutationContract =
  createDatabaseMutationContract<CompletionEffectsPreferences>(db, {
    target: completionEffectsPreferencesMutationTarget,
  });
export const mutationContract =
  createDatabaseMutationContract<MutationPayload>(db);
export const projectShell = createDatabaseProjectShell(db);
export const projectShellMutationContracts =
  createDatabaseProjectShellMutationContracts(db);
const backlogStore = createDatabaseBacklog(db);
export const backlog = createBacklogAccess(backlogStore);
export const backlogMutationContracts =
  createDatabaseBacklogMutationContracts(db);
export const sweepDueReappearSignals = (now = new Date()) =>
  sweepBacklogSignals(db, now);
const backlogReappearSignalWorker = createBacklogReappearSignalWorker({
  connectionString: env.DATABASE_URL,
  process: () => sweepDueReappearSignals(),
});
export const startBacklogReappearSignalWorker =
  backlogReappearSignalWorker.start;
export const stopBacklogReappearSignalWorker = backlogReappearSignalWorker.stop;
const personalReminderStore = createDatabasePersonalReminders(db);
export const personalReminders = personalReminderStore;
export const sweepDuePersonalReminders = (now = new Date()) =>
  personalReminderStore.fireDuePersonalReminders(now);
export const sweepDueWorkReviewLater = sweepDuePersonalReminders;
const personalReminderWorker = createPersonalReminderWorker({
  connectionString: env.DATABASE_URL,
  process: async () => (await sweepDuePersonalReminders()).processedCount,
});
export const startPersonalReminderWorker = personalReminderWorker.start;
export const stopPersonalReminderWorker = personalReminderWorker.stop;
export const releaseCommunication = createDatabaseReleaseCommunication(db, {
  // The Look again date replaces the Release's unsent Review Later reminder
  // instead of accumulating fires on it (see createLookAgainSchedule).
  schedule: createLookAgainSchedule(personalReminderStore),
});
const priorityMetricStore = createDatabasePriorityMetrics(db);
export const priorityMetrics = createPriorityMetricsAccess(priorityMetricStore);
export const priorityMetricMutationContracts =
  createDatabasePriorityMetricMutationContracts(
    db,
    priorityMetricPermanentDeleteEvents,
  );
const prioritizationSessionStore = createDatabasePrioritizationSessions(db);
export const prioritizationSessions = createPrioritizationSessionsAccess(
  prioritizationSessionStore,
);
export const prioritizationSessionMutationContracts =
  createDatabasePrioritizationSessionMutationContracts(db);
export const buildInPublic = createDatabaseBuildInPublic(db);
export const wikiPublishing = createDatabaseWikiPublishing(db, {
  documents,
  projectSourceRecords,
  smartCollections,
  technicalDiagrams,
});
export const workspaceOverview = createDatabaseWorkspaceOverview(db);
export const relations = createDatabaseRelations(db);
export const attentionSignals = createDatabaseAttentionSignals(db, {
  // The one Work insertion boundary also used by `Create work and link`.
  insertWork: (executor, owner, input) =>
    insertWorkWithKeyAllocation(
      executor as Parameters<typeof insertWorkWithKeyAllocation>[0],
      owner,
      input,
    ),
});
export const publicRoadmapReview = createDatabasePublicRoadmapReview(
  db,
  attentionSignals,
);
export const releaseEvidence = createDatabaseReleaseEvidence(db);
export const projectHistory = createDatabaseProjectHistory(db);
export const projectUpdates = createProjectUpdatesService(
  db,
  personalReminders,
);
const linkSharingAudit = createDatabaseLinkSharingAudit(db);
const linkSharingSecurityEvents =
  createDatabaseLinkSharingSecurityEvents(securityEventDb);
export const linkSharing = createDatabaseLinkSharing(db, {
  audit: linkSharingAudit,
  events: linkSharingSecurityEvents,
});
const trashExpiry = createDatabaseTrashExpiry(db);
const trashEventLog = createDatabaseTrashEventLog(securityEventDb);
export const trash = {
  ...createDatabaseTrash(
    db,
    createDatabaseTrashSurfaces(db, {
      events: securityEventDb,
      linkSharing,
      wikiPublishing,
    }),
  ),
  earlyDelete: createDatabaseTrashEarlyDelete(db, {
    events: trashEventLog,
    expiry: trashExpiry,
    projectName: async (accountId, projectId) =>
      (await projectShell.find(accountId, projectId))?.name ?? null,
  }),
};
/**
 * Security Redaction (spec 78 #504): the gate and preview only. No locator
 * source is registered until #505, so every spread target previews as not
 * searched and nothing is removed.
 */
export const securityRedaction = createSecurityRedaction({
  projectName: async (accountId, projectId) =>
    (await projectShell.find(accountId, projectId))?.name ?? null,
});
const trashMaintenance = createTrashMaintenance(trashExpiry, trashEventLog);
const linkSharingReplay = createDatabaseLinkSharingReplay(
  db,
  linkSharingSecurityEvents,
);
export const externalSurfaceResponseCache =
  createMemoryExternalSurfaceResponseCache();
export const externalSurfacePurges = createSurfacePurges({
  store: createDatabaseSurfacePurges(db),
  targets: [
    (surfaceId) =>
      externalSurfaceResponseCache.purge?.(surfaceId) ?? Promise.resolve(),
  ],
});
export const sweepExternalSurfacePurges = () => externalSurfacePurges.sweep();
export const externalSurfaceManagement = createExternalSurfaceManagement({
  // Reads the live source through the Link Sharing preview, so the directory
  // forks neither scope rules nor the diff.
  linkSource: async (accountId, record) => {
    if (!(record.rootId && record.rootKind)) {
      return null;
    }
    const preview = await linkSharing.preview(accountId, {
      root: {
        id: record.rootId,
        kind: record.rootKind as LinkSharingRootKind,
      },
      surfaceId: record.surfaceId,
    });
    return preview
      ? {
          hasChanges:
            (preview.diff?.added.length ?? 0) +
              (preview.diff?.changed.length ?? 0) +
              (preview.diff?.removed.length ?? 0) >
            0,
        }
      : null;
  },
  purges: externalSurfacePurges,
  revokeLink: (accountId, surfaceId) =>
    linkSharing.revoke(accountId, { surfaceId }),
  store: createDatabaseSurfaceDirectory(db),
  unpublishWiki: (accountId, documentId) =>
    wikiPublishing.unpublish(accountId, documentId),
});
export const linkSharingVisitor = createDatabaseLinkSharingVisitor(db, {
  audit: linkSharingAudit,
  rateSecret: env.BETTER_AUTH_SECRET,
});
export const projectActivity = createProjectActivity(
  createDatabaseProjectActivityStore(db),
);
export const projectClosureSummary = createDatabaseProjectClosureSummary(db);
export const valueChain = createDatabaseValueChain(db);
export const projectWall = createDatabaseProjectWall(db, relations, {
  collections: smartCollections,
  diagrams: technicalDiagrams,
  renderer: playwrightProjectWallSnapshotRenderer,
});
export const usageLinks = createDatabaseUsageLinks(db);
export const usageLinkMutationContracts =
  createDatabaseUsageLinkMutationContracts(db);
const documentTagRename = {
  inlineRename: createDatabaseDocumentTagRenameWriter(),
};
export const tags = createDatabaseTags(db, documentTagRename);
export const tagMutationContracts = createDatabaseTagMutationContracts(
  db,
  documentTagRename,
);
export const contacts = createDatabaseContacts(db);
export const feedback = createDatabaseFeedbackWithFeed(db);
export const screens = createDatabaseScreens(db);
export const plannedTests = createDatabasePlannedTests(db);
export const testGaps = createDatabaseTestGaps(db);
export const testReview = createDatabaseTestReview(db);
export const productGaps = createDatabaseProductGaps(db);
export const testReports = createDatabaseTestReports(db);
export const testAssessments = createDatabaseTestAssessments(db);
const configuredGitHub = createConfiguredGitHubIntegration(db, {
  appId: env.GITHUB_APP_ID,
  appSlug: env.GITHUB_APP_SLUG,
  // `Create work and link` uses the Work owner's Project-key allocation.
  createWork: (executor, owner, input) =>
    insertWorkWithKeyAllocation(executor, owner, {
      committedAt: new Date(),
      description: input.description === "" ? null : input.description,
      idempotencyKey: `github-create-work:${input.workId}`,
      originOwnerRecordId: input.originRecordId,
      payloadFingerprint: createHash("sha256")
        .update(input.workId)
        .digest("hex"),
      title: input.title,
      type: input.type,
      workId: input.workId,
    }),
  keyRing: env.GITHUB_APP_KEY_RING,
  keyVersion: env.GITHUB_APP_KEY_VERSION,
  privateKey: env.GITHUB_APP_PRIVATE_KEY,
});
export const gitHubIntegration = configuredGitHub.integration;
export const gitHubWebhookInbox = configuredGitHub.webhookInbox({
  bootstrapSecret: env.GITHUB_WEBHOOK_SECRET,
  enqueue: (deliveryId) => gitHubWebhookWorker.enqueue(deliveryId),
});
const gitHubWebhookWorker = createGitHubWebhookWorker({
  connectionString: env.DATABASE_URL,
  inbox: gitHubWebhookInbox,
});
export const startGitHubWebhookWorker = gitHubWebhookWorker.start;
export const stopGitHubWebhookWorker = gitHubWebhookWorker.stop;
export const specChangeReview = createSpecChangeReview(
  createDatabaseSpecChangeReviewStore(db),
  documents,
);
export const specChangeReviewMutationContracts =
  createDatabaseSpecChangeReviewMutationContracts(db);
export const customFields = createDatabaseCustomFields(db);
export const customFieldMutationContracts =
  createDatabaseCustomFieldMutationContracts(db);
const customFieldValueWriter = createDatabaseCustomFieldFinalizationWriter();
const workLifecycleBase = createDatabaseWorkLifecycle(db, {
  customFieldValueWriter,
});
const workAutomationRuntime = createDatabaseWorkAutomation(db, {
  createWork: async (transaction, creation: WorkAutomationWorkCreation) => {
    await insertWorkWithKeyAllocation(transaction, creation.project, {
      committedAt: creation.committedAt,
      description: null,
      idempotencyKey: creation.idempotencyKey,
      payloadFingerprint: creation.payloadFingerprint,
      title: creation.title,
      type: creation.type,
      workId: creation.workId,
    });
  },
  workHistoryProfile: (record) => toWorkProfile(record),
});
export const workAutomation = workAutomationRuntime.access;
export const workLifecycle = withWorkAutomationEvents(
  workLifecycleBase,
  workAutomationRuntime.engine,
);
export const returnToWork = createDatabaseReturnToWork(db, {
  projectMutations: projectShellMutationContracts,
  workLifecycle,
});
export const recordTable = createDatabaseRecordTable({
  customFieldValueWriter,
  database: db,
  projectShell,
  projectSourceRecords,
  workLifecycle,
});
export const workTemplates = createDatabaseWorkTemplates(db, workLifecycle);
export const workHandoffs = createDatabaseExternalExecutionHandoffs(db);
export const recordActions = createDatabaseRecordActions(db);
export const roadmapHorizon = createDatabaseRoadmapHorizon(db);
export const workContext = createWorkContextAccess(workLifecycle, relations, {
  priorityValues: async (accountId, work) => {
    const values = await priorityMetrics.values(accountId, work.id);
    return {
      effort: work.effort,
      priorityMetrics:
        values?.map(({ definition, value }) => ({
          id: definition.id,
          name: definition.name,
          projectId: definition.projectId,
          value: value?.rank ?? null,
        })) ?? [],
      targetDate: work.targetDate,
    };
  },
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
const fileAttachmentRepository = createDatabaseFileAttachments(db);
const fileAttachmentR2Config =
  env.R2_ACCESS_KEY_ID &&
  env.R2_ACCOUNT_ID &&
  env.R2_BUCKET &&
  env.R2_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        accountId: env.R2_ACCOUNT_ID,
        bucket: env.R2_BUCKET,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      }
    : undefined;
const fileAttachmentObjectStore = createFileAttachmentObjectStore({
  nodeEnv: env.NODE_ENV,
  r2: fileAttachmentR2Config,
});
// Visitors never see an R2 URL: the product reads the exact object itself,
// after the surface, session and file version are authorized.
export const linkSharingAssets = fileAttachmentObjectStore
  ? createLinkSharingAssets({
      objects: {
        async read(key) {
          try {
            return await fileAttachmentObjectStore.read(key);
          } catch {
            return null;
          }
        },
      },
      visitor: linkSharingVisitor,
    })
  : undefined;
let processFileAttachmentPreview:
  | ((
      job: {
        accountId: string;
        attachmentId: string;
        versionId: string;
      },
      options: FileAttachmentPreviewProcessOptions,
    ) => Promise<void>)
  | undefined;
const fileAttachmentPreviewWorker = fileAttachmentObjectStore
  ? createFileAttachmentPreviewWorker({
      connectionString: env.DATABASE_URL,
      process: async (job, options) => {
        if (!processFileAttachmentPreview) {
          throw new Error("File Attachment preview worker is not ready.");
        }
        await processFileAttachmentPreview(job, options);
      },
    })
  : undefined;
const fileAttachmentService = fileAttachmentObjectStore
  ? createFileAttachments({
      locationWork: createFileAttachmentLocationWork(
        workLifecycle,
        projectShell,
      ),
      objectStore: fileAttachmentObjectStore,
      repository: fileAttachmentRepository,
      schedulePreview: fileAttachmentPreviewWorker?.enqueue,
    })
  : undefined;
processFileAttachmentPreview = fileAttachmentService?.processPreview;
export const fileAttachments = fileAttachmentService?.access;
export const wikiPublicPages = createWikiPublicRoutes({
  access: createExternalSurfaceAccess({
    cache: externalSurfaceResponseCache,
    reader: createDatabaseExternalSurfaceStateReader(db),
  }),
  assets: createDatabaseWikiPublicAssets(db, fileAttachments),
  snapshots: createDatabaseWikiPublicSnapshots(db),
});
const buildInPublicStateReader = createDatabaseExternalSurfaceStateReader(db);
export const buildInPublicPages = createBuildInPublicRoutes({
  access: createExternalSurfaceAccess({
    cache: createMemoryExternalSurfaceResponseCache(),
    reader: buildInPublicStateReader,
  }),
  assets: createDatabaseBuildInPublicAssets(db, fileAttachments),
  reader: buildInPublicStateReader,
  slugs: createDatabaseBuildInPublicSlugs(db),
  snapshots: createDatabaseBuildInPublicSnapshots(db),
  viewer: createDatabaseBuildInPublicViewer(db, {
    accountOf: async (request) =>
      (await auth.api.getSession({ headers: request.headers }))?.user.id ??
      null,
    appOrigin: env.CORS_ORIGIN,
  }),
});
export const moodboardSnapshots = createDatabaseMoodboardSnapshots(db, {
  objectStore: fileAttachmentObjectStore,
});
export const startFileAttachmentPreviewWorker = () =>
  fileAttachmentPreviewWorker?.start() ?? Promise.resolve();
export const stopFileAttachmentPreviewWorker = () =>
  fileAttachmentPreviewWorker?.stop() ?? Promise.resolve();
export const sweepExpiredFileAttachmentUploads = () =>
  fileAttachmentService?.sweepExpiredUploads() ?? Promise.resolve(0);

/** Gate attempts die 24h after the last attempt, sessions at their end. */
export const sweepExpiredLinkSharingVisitorData = () =>
  purgeLinkSharingVisitorData(db);
export const captureInbox = createDatabaseCaptureInbox(
  db,
  captureInboxWorkCreate,
  captureInboxMutationContract,
  env.NODE_ENV === "production"
    ? undefined
    : createDevelopmentCaptureInboxTriageAdapter(),
  webCaptureStaging
    ? createR2CaptureInboxStagingStore(webCaptureStaging, fileAttachmentService)
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
      // Retention maintenance replays permanent deletes before sweeping. Include
      // it in the startup barrier so the same event history is not replayed twice.
      priorityMetricTrashMaintenance.sweepExpired(),
      // Replay re-erases records an old backup brought back after a Trash permanent delete.
      trashMaintenance.replayPermanentDeletes(),
      documentTransfers.replayCancellations(),
      linkSharingReplay.replay(),
    ])
      .then(() => undefined)
      .catch((error) => {
        securityReplay = undefined;
        throw error;
      });
  }
  return securityReplay;
}

export function sweepExpiredPriorityMetrics(now = new Date()) {
  return priorityMetricTrashMaintenance.sweepExpired(now);
}

export function sweepExpiredTrash(now = new Date()) {
  return trashMaintenance.sweepExpired(now);
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

export const sweepExpiredResearchSessionBindingPreviews = () =>
  sweepExpiredResearchBindingPreviews(db);

const maintenanceWorker = createMaintenanceWorker({
  connectionString: env.DATABASE_URL,
  sweeps: [
    {
      name: "research-binding-preview-sweep",
      cron: "*/15 * * * *",
      process: sweepExpiredResearchSessionBindingPreviews,
    },
    {
      name: "file-attachment-upload-sweep",
      cron: "0 * * * *",
      process: sweepExpiredFileAttachmentUploads,
    },
    {
      // Retries the cache and index purge of removed surfaces; never reopens one.
      name: "external-surface-purge-sweep",
      cron: "*/5 * * * *",
      process: sweepExternalSurfacePurges,
    },
    {
      // Retention promises gate attempt data gone 24h after the last attempt,
      // also when a surface stops being visited (visitor purge only runs lazily).
      name: "link-sharing-visitor-sweep",
      cron: "0 * * * *",
      process: sweepExpiredLinkSharingVisitorData,
    },
    {
      // Incremental read-only reconcile of every active GitHub link (<= 15 min).
      name: "github-reconcile",
      cron: "*/15 * * * *",
      process: async () => {
        await gitHubIntegration.reconcileDue();
        await gitHubWebhookInbox.redrivePending();
      },
    },
    {
      // Payload and delivery retention plus the 90-day webhook secret alarm.
      name: "github-webhook-retention",
      cron: "17 * * * *",
      process: async () => {
        await gitHubWebhookInbox.sweepRetention();
        await gitHubWebhookInbox.checkSecretAge();
      },
    },
    {
      name: "priority-metric-trash-sweep",
      cron: "0 * * * *",
      process: () => sweepExpiredPriorityMetrics(),
    },
    {
      // The 30-day Trash clock ends here: whole Project delete groups at once.
      name: "trash-expiry-sweep",
      cron: "5 * * * *",
      process: async () => {
        await sweepExpiredTrash();
      },
    },
  ],
});
export const startMaintenanceWorker = maintenanceWorker.start;
export const stopMaintenanceWorker = maintenanceWorker.stop;
