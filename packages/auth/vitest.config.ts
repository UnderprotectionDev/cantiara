import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			// Keep Account Access tests on local Postgres even when the server
			// .env points at hosted Neon.
			DATABASE_URL: "postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara",
			NODE_ENV: "test",
			SKIP_ENV_VALIDATION: "1",
		},
		environment: "node",
		fileParallelism: false,
	},
});
