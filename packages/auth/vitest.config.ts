import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			NODE_ENV: "test",
			SKIP_ENV_VALIDATION: "1",
		},
		environment: "node",
		fileParallelism: false,
	},
});
