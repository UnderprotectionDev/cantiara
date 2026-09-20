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
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  relations,
  replaySecurityRevocations,
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

export default createApp({
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
  desktopOrigins,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
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
