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
  captureInbox,
  customFieldMutationContracts,
  customFields,
  fileAttachments,
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  relations,
  replaySecurityRevocations,
  sweepExpiredFileAttachmentUploads,
  tagMutationContracts,
  tags,
  tauriSessionAccess,
  usageLinkMutationContracts,
  usageLinks,
  webCapture,
  workDrafts,
  workLifecycle,
} from "./services";

initLogger({
  env: { service: "cantiara-server" },
});

await replaySecurityRevocations();
await sweepExpiredFileAttachmentUploads();
setInterval(
  () => {
    sweepExpiredFileAttachmentUploads().catch(() => undefined);
  },
  60 * 60 * 1000,
);

const app = createApp({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  auth,
  captureInbox,
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
  projectShell,
  projectShellMutationContracts,
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
  workDrafts,
  workLifecycle,
});

// Bun's implicit server caps request bodies at 128 MiB, which would reject the
// largest File Attachment type (250 MB video) before the stage route runs; the
// explicit limit follows the accepted type matrix plus multipart form overhead.
serve({
  fetch: app.fetch,
  maxRequestBodySize: FILE_ATTACHMENT_UPLOAD_BODY_LIMIT,
  port: Number(process.env.PORT ?? 3000),
});
