import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

const DASHBOARD_URL_PATTERN = /\/dashboard$/;
const PREFERENCES_URL_PATTERN = /\/account\/preferences$/;
const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const COMMAND_PALETTE_VISIBLE_BUDGET_MS = {
  p95: 150,
  p99: 300,
} as const;
const HOT_CACHE_SAMPLES = 500;
const COLD_CACHE_SAMPLES = 100;
const COLD_CACHE_BATCH_SIZE = 5;
const COMMAND_PALETTE_TRIGGER_SELECTOR =
  'header button[aria-keyshortcuts="Control+K Meta+K"]';

async function establishFounderSession(
  page: Page,
  context: BrowserContext,
  request: APIRequestContext,
) {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=command-palette`,
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

function measureVisibilitySamples(
  page: Page,
  sampleCount: number,
): Promise<number[]> {
  return page.evaluate(
    ({ count: requestedCount, triggerSelector }) => {
      const nextFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const waitFor = (condition: () => boolean) => {
        const deadline = performance.now() + 5000;
        const poll = async (): Promise<void> => {
          if (condition()) {
            return;
          }
          if (performance.now() >= deadline) {
            throw new Error(
              "Command Palette did not reach the expected state.",
            );
          }
          await nextFrame();
          return poll();
        };
        return poll();
      };

      const collectSamples = async (remaining: number): Promise<number[]> => {
        if (remaining === 0) {
          return [];
        }

        const trigger =
          document.querySelector<HTMLButtonElement>(triggerSelector);
        if (!trigger) {
          throw new Error("Command Palette trigger was not found.");
        }

        const start = performance.now();
        trigger.click();
        await waitFor(() => Boolean(document.querySelector('[role="dialog"]')));
        const sample = performance.now() - start;

        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        dialog?.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            key: "Escape",
          }),
        );
        await waitFor(() => !document.querySelector('[role="dialog"]'));

        return [sample, ...(await collectSamples(remaining - 1))];
      };

      return collectSamples(requestedCount);
    },
    { count: sampleCount, triggerSelector: COMMAND_PALETTE_TRIGGER_SELECTOR },
  );
}

async function measureColdCacheSamples(context: BrowserContext, count: number) {
  // A fresh page resets the application command/query state without multiplying
  // the reference workspace startup cost across isolated browser contexts.
  const samples: number[] = [];

  const measureBatch = async (offset: number): Promise<void> => {
    if (offset >= count) {
      return;
    }

    const batchSize = Math.min(COLD_CACHE_BATCH_SIZE, count - offset);
    const pages = await Promise.all(
      Array.from({ length: batchSize }, async (_, pageIndex) => {
        const page = await context.newPage();
        // Keep each synthetic cold-cache page out of Better Auth's shared
        // per-path rate-limit bucket while preserving the real auth boundary.
        await page.setExtraHTTPHeaders({
          "x-forwarded-for": `198.51.100.${offset + pageIndex + 1}`,
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(DASHBOARD_URL_PATTERN);
        await expect(
          page.getByRole("heading", { name: "Dashboard", level: 1 }),
        ).toBeVisible();
        await page.waitForSelector(COMMAND_PALETTE_TRIGGER_SELECTOR);
        return page;
      }),
    );

    const batchSamples = await Promise.all(
      pages.map(async (page) => {
        const [sample] = await measureVisibilitySamples(page, 1);
        return sample ?? Number.POSITIVE_INFINITY;
      }),
    );
    samples.push(...batchSamples);
    await Promise.all(pages.map((page) => page.close()));
    return measureBatch(offset + batchSize);
  };

  await measureBatch(0);

  return samples;
}

function percentile(samples: readonly number[], rank: number) {
  const sortedSamples = [...samples].sort((left, right) => left - right);
  return (
    sortedSamples[Math.ceil(sortedSamples.length * rank) - 1] ??
    Number.POSITIVE_INFINITY
  );
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
  const trigger = page.locator(COMMAND_PALETTE_TRIGGER_SELECTOR);
  await expect(
    page.getByRole("button", { name: "Switch Project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create", exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeVisible();
  const palette = page.getByRole("dialog", { name: "Command Palette" });

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
  await commandInput.fill("Reference Work 09999");
  await expect(
    palette.getByText("Reference Work 09999", { exact: true }),
  ).toBeVisible();
  await expect(
    palette.getByText("Reference Work 00000", { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await commandInput.fill("Switch Project");
  await page.keyboard.press("Enter");
  await expect(
    palette.getByText("Reference Project 01", { exact: true }),
  ).toBeVisible();
  await commandInput.fill("Reference Project 01");
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await commandInput.fill("Create");
  await page.keyboard.press("Enter");
  await expect(palette.getByText("Create Work", { exact: true })).toBeVisible();
  await commandInput.fill("Work");
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await commandInput.fill("Unsupported reference command");
  await page.keyboard.press("Enter");
  await expect(palette.getByRole("alert")).toContainText("Can’t run this here");
  await expect(palette.getByRole("alert")).toContainText(
    "Unsupported reference command is unavailable in this context.",
  );

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("measures Command Palette visibility at the reference workspace scale", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(300_000);
  await establishFounderSession(page, context, request);
  await page.goto("/dashboard");

  const trigger = page.locator(COMMAND_PALETTE_TRIGGER_SELECTOR);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(trigger).toBeVisible();

  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);

  const hotCacheSamples = await measureVisibilitySamples(
    page,
    HOT_CACHE_SAMPLES,
  );
  const coldCacheSamples = await measureColdCacheSamples(
    context,
    COLD_CACHE_SAMPLES,
  );

  expect(hotCacheSamples).toHaveLength(HOT_CACHE_SAMPLES);
  expect(coldCacheSamples).toHaveLength(COLD_CACHE_SAMPLES);

  expect(
    percentile(hotCacheSamples, 0.95),
    "Hot-cache Command Palette p95 visibility budget",
  ).toBeLessThanOrEqual(COMMAND_PALETTE_VISIBLE_BUDGET_MS.p95);
  expect(
    percentile(hotCacheSamples, 0.99),
    "Hot-cache Command Palette p99 visibility budget",
  ).toBeLessThanOrEqual(COMMAND_PALETTE_VISIBLE_BUDGET_MS.p99);
  expect(
    percentile(coldCacheSamples, 0.95),
    "Cold-cache Command Palette p95 visibility budget",
  ).toBeLessThanOrEqual(COMMAND_PALETTE_VISIBLE_BUDGET_MS.p95);
  expect(
    percentile(coldCacheSamples, 0.99),
    "Cold-cache Command Palette p99 visibility budget",
  ).toBeLessThanOrEqual(COMMAND_PALETTE_VISIBLE_BUDGET_MS.p99);
});

test("keeps the Command Palette accessible to keyboard and assistive technology", async ({
  context,
  page,
  request,
}) => {
  await establishFounderSession(page, context, request);
  await page.goto("/dashboard");

  const trigger = page.locator(COMMAND_PALETTE_TRIGGER_SELECTOR);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();

  const accessibilityScan = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibilityScan.violations).toEqual([]);
  await expect(palette).toHaveAccessibleDescription(
    "Run an authorized product command.",
  );
  await expect(
    palette.getByRole("combobox", {
      name: "Filter Command Palette commands",
    }),
  ).toHaveAttribute("aria-autocomplete", "list");
  await expect(
    palette.getByRole("listbox", { name: "Command Palette commands" }),
  ).toBeVisible();

  const commandInput = palette.getByRole("combobox", {
    name: "Filter Command Palette commands",
  });
  await commandInput.fill("Open Dashboard");
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
