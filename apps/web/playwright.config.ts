import { defineConfig, devices } from "@playwright/test";

const serverUrl = "http://127.0.0.1:3100";
const webUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  use: {
    baseURL: webUrl,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "bun ../server/e2e/account-access-server.ts",
      reuseExistingServer: !process.env.CI,
      url: serverUrl,
    },
    {
      command: `VITE_SERVER_URL=${serverUrl} bun run dev --host 127.0.0.1 --port 4173`,
      reuseExistingServer: !process.env.CI,
      url: webUrl,
    },
  ],
});
