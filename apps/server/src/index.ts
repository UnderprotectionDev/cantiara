import { initLogger } from "evlog";

import { createApp } from "./app";
import { desktopOrigins, env, redactSecrets } from "./env";
import {
  accountPreferences,
  accountSessionAccess,
  auth,
  getDb,
  githubAvailability,
  githubIdentityConfirmation,
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
  auth,
  corsOrigin: env.CORS_ORIGIN,
  database: getDb(),
  desktopOrigins,
  githubAvailability,
  githubIdentityConfirmation,
  nodeEnv: env.NODE_ENV,
  redactSecrets,
  tauriSessionAccess,
  trustedProxyIps: env.TRUSTED_PROXY_IPS,
});
