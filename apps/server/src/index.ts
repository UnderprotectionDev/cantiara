import { initLogger } from "evlog";

import { createApp } from "./app";
import { desktopOrigins, env, redactSecrets } from "./env";
import {
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  accountSessionAccess,
  auth,
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
  mutationContract,
  projectShell,
  projectShellMutationContracts,
  replaySessionRevocations,
  tauriSessionAccess,
} from "./services";

initLogger({
  env: { service: "cantiara-server" },
});

await replaySessionRevocations();

export default createApp({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility,
  accountPreferencesMutationContract,
  auth,
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
});
