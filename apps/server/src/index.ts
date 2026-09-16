import { initLogger } from "evlog";

import { createApp } from "./app";
import { desktopOrigins, env, redactSecrets } from "./env";
import {
  accountSessionAccess,
  auth,
  getDb,
  githubAvailability,
  replaySessionRevocations,
} from "./services";

initLogger({
  env: { service: "cantiara-server" },
});

await replaySessionRevocations();

export default createApp({
  accountSessionAccess,
  auth,
  corsOrigin: env.CORS_ORIGIN,
  database: getDb(),
  desktopOrigins,
  githubAvailability,
  nodeEnv: env.NODE_ENV,
  redactSecrets,
});
