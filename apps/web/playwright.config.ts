import { defineConfig, devices } from "@playwright/test";

const serverPort = process.env.PLAYWRIGHT_SERVER_PORT ?? "3100";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "4173";
const serverUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

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
      command: `E2E_SERVER_PORT=${serverPort} E2E_WEB_ORIGIN=${webUrl} bun ../server/e2e/account-access-server.ts`,
      reuseExistingServer: !process.env.CI,
      url: serverUrl,
    },
    {
      command: `VITE_COMMAND_PALETTE_E2E_FIXTURE=reference VITE_SERVER_URL=${serverUrl} bun run dev --host 127.0.0.1 --port ${webPort}`,
      reuseExistingServer: !process.env.CI,
      url: webUrl,
    },
  ],
});
