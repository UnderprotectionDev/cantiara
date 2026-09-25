import { FILE_ATTACHMENT_UPLOAD_BODY_LIMIT } from "@cantiara/api/file-attachments";
import { serve } from "bun";
import { initLogger } from "evlog";

import { createApp } from "./app";
import { desktopOrigins, env, redactSecrets } from "./env";
import {
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  accountSessionAccess,
  auth,
  backlog,
  backlogMutationContracts,
  captureInbox,
  completionEffectsPreferences,
  completionEffectsPreferencesMutationContract,
  customFieldMutationContracts,
  customFields,
  fileAttachments,
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  prioritizationSessionMutationContracts,
  prioritizationSessions,
  priorityMetricMutationContracts,
  priorityMetrics,
  projectShell,
  projectShellMutationContracts,
  recordActions,
  relations,
  replaySecurityRevocations,
  startBacklogReappearSignalWorker,
  startFileAttachmentPreviewWorker,
  sweepExpiredFileAttachmentUploads,
  sweepExpiredPriorityMetrics,
  tagMutationContracts,
  tags,
  tauriSessionAccess,
  usageLinkMutationContracts,
  usageLinks,
  webCapture,
  workContext,
  workDrafts,
  workHandoffs,
  workLifecycle,
  workspaceOverview,
  workTemplates,
} from "./services";

initLogger({
  env: { service: "cantiara-server" },
});

await replaySecurityRevocations();
await startFileAttachmentPreviewWorker();
await startBacklogReappearSignalWorker();
await sweepExpiredFileAttachmentUploads();
await sweepExpiredPriorityMetrics();
setInterval(
  () => {
    sweepExpiredFileAttachmentUploads().catch(() => undefined);
  },
  60 * 60 * 1000,
);
setInterval(
  () => {
    sweepExpiredPriorityMetrics().catch(() => undefined);
  },
  60 * 60 * 1000,
);

const app = createApp({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  auth,
  backlog,
  backlogMutationContracts,
  captureInbox,
  completionEffectsPreferences,
  completionEffectsPreferencesMutationContract,
  customFields,
  customFieldMutationContracts,
  desktopApiWindow: {
    currentContract: env.CANTIARA_DESKTOP_API_CURRENT_CONTRACT,
    previousContract: env.CANTIARA_DESKTOP_API_PREVIOUS_CONTRACT,
    publishedAt: env.CANTIARA_DESKTOP_API_PUBLISHED_AT,
  },
  corsOrigin: env.CORS_ORIGIN,
  database: getDb(),
  fileAttachments,
  desktopOrigins,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  priorityMetricMutationContracts,
  priorityMetrics,
  prioritizationSessionMutationContracts,
  prioritizationSessions,
  projectShell,
  projectShellMutationContracts,
  recordActions,
  tags,
  tagMutationContracts,
  relations,
  nodeEnv: env.NODE_ENV,
  redactSecrets,
  tauriSessionAccess,
  trustedProxyIps: env.TRUSTED_PROXY_IPS,
  usageLinkMutationContracts,
  usageLinks,
  webCapture,
  workHandoffs,
  workContext,
  workDrafts,
  workLifecycle,
  workTemplates,
  workspaceOverview,
});

// Bun's implicit server caps request bodies at 128 MiB, which would reject the
// largest File Attachment type (250 MB video) before the stage route runs; the
// explicit limit follows the accepted type matrix plus multipart form overhead.
serve({
  fetch: app.fetch,
  maxRequestBodySize: FILE_ATTACHMENT_UPLOAD_BODY_LIMIT,
  port: Number(process.env.PORT ?? 3000),
});
