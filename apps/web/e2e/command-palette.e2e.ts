import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import { COMMAND_PALETTE_VISIBLE_BUDGET_MS } from "../src/features/command-palette/components/command-palette-commands";

const DASHBOARD_URL_PATTERN = /\/dashboard$/;
const PREFERENCES_URL_PATTERN = /\/account\/preferences$/;

async function establishFounderSession(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
) {
  const setupResponse = await request.get(
    "http://127.0.0.1:3100/__e2e/setup?fixture=command-palette",
  );
  const setup = (await setupResponse.json()) as {
    cookie: {
      domain: string;
      expires?: number;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "None" | "Strict";
      secure: boolean;
      value: string;
    };
  };
  await context.addCookies([setup.cookie]);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(DASHBOARD_URL_PATTERN);
}

async function measureVisibilitySamples(
  page: Page,
  trigger: Locator,
  palette: Locator,
  remaining: number,
  samples: number[] = [],
): Promise<number[]> {
  if (remaining === 0) {
    return samples;
  }

  await trigger.focus();
  const start = await page.evaluate(() => performance.now());
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  const visibleAt = await page.evaluate(() => performance.now());
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);

  return measureVisibilitySamples(page, trigger, palette, remaining - 1, [
    ...samples,
    visibleAt - start,
  ]);
}

test("opens the founder Command Palette across contexts and keeps it off public pages", async ({
  context,
  page,
  request,
}) => {
  await establishFounderSession(page, context, request);

  await page.goto("/");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Command Palette" }),
  ).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();
  const trigger = page.locator(
    'header button[aria-keyshortcuts="Control+K Meta+K"]',
  );
  await expect(
    page.getByRole("button", { name: "Switch Project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create", exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeVisible();
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  const visibilitySamples = await measureVisibilitySamples(
    page,
    trigger,
    palette,
    20,
  );

  const sortedVisibilitySamples = [...visibilitySamples].sort(
    (left, right) => left - right,
  );
  const percentile = (rank: number) =>
    sortedVisibilitySamples[
      Math.ceil(sortedVisibilitySamples.length * rank) - 1
    ];

  expect(percentile(0.95)).toBeLessThanOrEqual(
    COMMAND_PALETTE_VISIBLE_BUDGET_MS.p95,
  );
  expect(percentile(0.99)).toBeLessThanOrEqual(
    COMMAND_PALETTE_VISIBLE_BUDGET_MS.p99,
  );

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await expect(
    palette.getByText("Switch Project", { exact: true }),
  ).toBeVisible();
  await expect(palette.getByText("Create", { exact: true })).toBeVisible();
  await expect(
    palette.getByText("Target: Authorized Projects", { exact: false }),
  ).toBeVisible();

  const commandInput = page.getByRole("combobox", {
    name: "Filter Command Palette commands",
  });
  await commandInput.fill("does not exist");
  await expect(
    palette.getByText("No matching command", { exact: true }),
  ).toBeVisible();

  await commandInput.fill("Open Preferences");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PREFERENCES_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Preferences", level: 1 }),
  ).toBeVisible();

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await commandInput.fill("Create");
  await page.keyboard.press("Enter");
  await expect(palette.getByRole("alert")).toContainText("Can’t run this here");
  await expect(palette.getByRole("alert")).toContainText(
    "Create is unavailable in this context.",
  );

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
