import { initLogger } from "evlog";

import { createApp } from "./app";
import { desktopOrigins, env, redactSecrets } from "./env";
import {
  accountSessionAccess,
  auth,
  getDb,
  replaySessionRevocations,
} from "./services";

initLogger({
  env: { service: "cantiara-server" },
});

export default createApp({
  accountSessionAccess,
  auth,
  corsOrigin: env.CORS_ORIGIN,
  database: getDb(),
  desktopOrigins,
  nodeEnv: env.NODE_ENV,
  redactSecrets,
  replaySessionRevocations,
});
