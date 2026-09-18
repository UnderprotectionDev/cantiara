import { defineConfig, devices } from "@playwright/test";

const serverPort = process.env.PLAYWRIGHT_SERVER_PORT ?? "3100";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "4173";
const serverUrl = `http://127.0.0.1:${serverPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const extensionOnly = process.env.PLAYWRIGHT_EXTENSION_E2E === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: extensionOnly ? "**/web-capture-extension.e2e.ts" : "**/*.e2e.ts",
  fullyParallel: false,
  // The reference Command Palette fixture allocates 15,000 records; keep the
  // CI browser suite from starving concurrent tests while measuring it.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: webUrl,
    ...devices["Desktop Chrome"],
  },
  webServer: extensionOnly
    ? []
    : [
        {
          command: `E2E_SERVER_PORT=${serverPort} E2E_WEB_ORIGIN=${webUrl} bun --env-file=../server/.env.local ../server/e2e/account-access-server.ts`,
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
