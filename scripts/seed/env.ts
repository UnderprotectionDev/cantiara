import { config } from "dotenv";

config({ path: "apps/server/.env" });

process.env.NODE_ENV ??= "development";
process.env.SKIP_ENV_VALIDATION ??= "true";
