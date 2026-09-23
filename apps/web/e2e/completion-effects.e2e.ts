import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Route,
  test,
} from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

interface AccountSessionSetup {
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
}

async function signInWithAccountPreferencesFixture(
  context: BrowserContext,
  request: APIRequestContext,
) {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences`,
  );
  expect(setupResponse).toBeOK();
  const setup = (await setupResponse.json()) as AccountSessionSetup;
  await context.addCookies([setup.cookie]);
}

test("keeps Completion Effects samples still until Preview and saves one Account choice", async ({
  context,
  page,
  request,
}) => {
  await signInWithAccountPreferencesFixture(context, request);

  await page.goto("/account/completion-effects");
  await expect(
    page.getByRole("heading", { name: "Completion effects", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Theme", { exact: true })).toBeVisible();
  await expect(page.getByText("Palette", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Preview", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: "Enable" })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Calm" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Haze" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  const specimen = page.locator(".completion-effect-specimen");
  await expect(specimen).toHaveAttribute("data-previewing", "false");
  await expect(specimen.locator('[data-sample-element="calm"]')).toHaveCSS(
    "animation-name",
    "none",
  );

  const rpcRequests: string[] = [];
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("/rpc/")) {
      rpcRequests.push(browserRequest.url());
    }
  });
  await page.getByRole("button", { name: "Weave" }).click();
  await expect(page.getByRole("button", { name: "Loom" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Lattice" }).click();
  await page.getByRole("switch", { name: "Enable" }).click();

  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(specimen).toHaveAttribute("data-previewing", "true");
  await expect(specimen.locator('[data-sample-element="weave"]')).toHaveCSS(
    "animation-name",
    "completion-effect-weave",
  );
  await page.getByRole("button", { name: "Calm" }).click();
  await expect(specimen).toHaveAttribute("data-previewing", "false");
  await expect(specimen.locator('[data-sample-element="calm"]')).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "Weave" }).click();
  await page.getByRole("button", { name: "Lattice" }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(specimen).toHaveAttribute("data-previewing", "true");
  await expect(specimen.locator('[data-sample-element="weave"]')).toHaveCSS(
    "animation-name",
    "completion-effect-weave",
  );
  await page.clock.fastForward(1200);
  await expect(page.getByRole("status")).toHaveText("Preview finished.");
  expect(rpcRequests).toEqual([]);
  await page.clock.resume();

  let releaseSaveRequest: (() => void) | undefined;
  let saveRequestIntercepted = false;
  const saveRequestGate = new Promise<void>((resolve) => {
    releaseSaveRequest = () => resolve();
  });
  const holdSaveRequest = async (route: Route) => {
    saveRequestIntercepted = true;
    await saveRequestGate;
    await route.continue();
  };
  await page.route("**/rpc/saveCompletionEffectsPreferences", holdSaveRequest);
  const saveResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/rpc/"),
  );
  const saveAction = page
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect.poll(() => saveRequestIntercepted).toBe(true);
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  releaseSaveRequest?.();
  await saveAction;
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok()).toBe(true);
  await page.unroute(
    "**/rpc/saveCompletionEffectsPreferences",
    holdSaveRequest,
  );
  expect(rpcRequests).toHaveLength(1);
  await expect(
    page.getByText("Completion effects saved.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Enable" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Weave" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Lattice" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("keeps Preview static and describes its motion under Reduce Motion", async ({
  context,
  page,
  request,
}) => {
  await signInWithAccountPreferencesFixture(context, request);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/account/completion-effects");
  await expect(
    page.getByText("Reduce Motion is on. Preview stays still."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Static sample shown. Soft shapes drift upward and settle.",
  );
  await expect(page.locator(".completion-effect-specimen")).toHaveAttribute(
    "data-previewing",
    "false",
  );
  await expect(
    page.locator('.completion-effect-specimen [data-sample-element="calm"]'),
  ).toHaveCSS("animation-name", "none");
});
