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
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  replaySecurityRevocations,
  tauriSessionAccess,
  webCapture,
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
  nodeEnv: env.NODE_ENV,
  redactSecrets,
  tauriSessionAccess,
  trustedProxyIps: env.TRUSTED_PROXY_IPS,
  webCapture,
  workLifecycle,
});
