import AxeBuilder from "@axe-core/playwright";
import {
  DESKTOP_API_CONTRACT_HEADER,
  DESKTOP_API_CURRENT_CONTRACT,
} from "@cantiara/api/desktop-api-window";
import type { AppRouterClient } from "@cantiara/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  type Route,
  test,
} from "@playwright/test";
import { openWorkRecordFromKanbanList } from "./kanban-test-helpers";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const E2E_WEB_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? "4173"}`;
const WORK_STATUS_COMBOBOX_NAME = /Status for/;
const CLOSE_DIALOG_NAME = /Close/;
const REOPEN_DIALOG_NAME = /Reopen/;
const CLOSURE_RESULT_COMBOBOX_NAME = /Closure result for/;

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
  tauriBearerToken?: string;
}

async function signInWithAccountPreferencesFixture(
  context: BrowserContext,
  request: APIRequestContext,
  fixture = "account-preferences",
) {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=${fixture}`,
  );
  expect(setupResponse).toBeOK();
  const setup = (await setupResponse.json()) as AccountSessionSetup;
  await context.addCookies([setup.cookie]);
  return setup;
}

function createAccountApiClient(cookie: AccountSessionSetup["cookie"]) {
  return createORPCClient<AppRouterClient>(
    new RPCLink({
      url: `${E2E_SERVER_URL}/rpc`,
      fetch(input, init) {
        const requestInit = init as RequestInit;
        const headers = new Headers(requestInit.headers);
        headers.set("cookie", `${cookie.name}=${cookie.value}`);
        headers.set("origin", E2E_WEB_URL);
        return globalThis.fetch(input, { ...requestInit, headers });
      },
    }),
  );
}

function createRequestGate() {
  let releaseGate!: () => void;
  let notifyStarted!: () => void;
  let wasStarted = false;
  const wait = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });

  return {
    notifyStarted: () => {
      if (!wasStarted) {
        wasStarted = true;
        notifyStarted();
      }
    },
    release: () => releaseGate(),
    started,
    wait: () => wait,
  };
}

async function enableCompletionEffects(page: Page) {
  await page.goto("/account/completion-effects");
  const enabled = page.getByRole("switch", { name: "Enable" });
  if (!(await enabled.isChecked())) {
    await enabled.click();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Completion effects saved.", { exact: true }),
  ).toBeVisible();
}

async function openProjectWorkSurface(page: Page, projectName: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
}

async function createWork(page: Page, title: string) {
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const work = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ has: page.locator("p").filter({ hasText: title }) });
  await expect(work).toBeVisible({ timeout: 20_000 });
  return work;
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

  const accessibilityScan = await new AxeBuilder({ page })
    .include("main")
    .analyze();
  expect(accessibilityScan.violations).toEqual([]);

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

test("shares Completion Effects preferences with an authenticated Tauri client", async ({
  context,
  page,
  request,
}) => {
  const setup = await signInWithAccountPreferencesFixture(
    context,
    request,
    "completion-effects",
  );
  if (!setup.tauriBearerToken) {
    throw new Error(
      "The Completion Effects fixture did not provide a Tauri session.",
    );
  }
  const tauriClient = createORPCClient<AppRouterClient>(
    new RPCLink({
      url: `${E2E_SERVER_URL}/rpc`,
      fetch(input, init) {
        const headers = new Headers(
          input instanceof Request ? input.headers : undefined,
        );
        headers.set("authorization", `Bearer ${setup.tauriBearerToken}`);
        headers.set(DESKTOP_API_CONTRACT_HEADER, DESKTOP_API_CURRENT_CONTRACT);
        headers.set("origin", "http://tauri.localhost");
        return fetch(input, { ...init, headers });
      },
    }),
  );

  await page.goto("/account/completion-effects");
  await page.getByRole("button", { name: "Nova" }).click();
  await page.getByRole("button", { name: "Flare" }).click();
  await page.getByRole("switch", { name: "Enable" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Completion effects saved.", { exact: true }),
  ).toBeVisible();

  const webPreferences = await tauriClient.completionEffectsPreferences();
  expect(webPreferences).toMatchObject({
    enabled: true,
    palette: "Flare",
    theme: "Nova",
  });

  const tauriPreferences = await tauriClient.saveCompletionEffectsPreferences({
    baseRevision: webPreferences.revision,
    clientIdempotencyKey: crypto.randomUUID(),
    preferences: {
      enabled: false,
      palette: "Halo",
      theme: "Arc",
    },
  });
  expect(tauriPreferences).toMatchObject({
    enabled: false,
    palette: "Halo",
    theme: "Arc",
  });

  await page.reload();
  await expect(page.getByRole("switch", { name: "Enable" })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Arc" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Halo" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("plays only after an accepted Completed close and waits 30 seconds per client", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");
  await enableCompletionEffects(page);
  await openProjectWorkSurface(page, "Completion Effects Project");
  const firstWork = await createWork(page, "Complete the first release task");
  const secondWork = await createWork(page, "Complete the second release task");
  const thirdWork = await createWork(page, "Complete after the client wait");
  const fourthWork = await createWork(page, "Complete after a hidden start");
  const projectWorkUrl = page.url();

  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));

  let releaseCloseRequest: (() => void) | undefined;
  let closeRequestIntercepted = false;
  const closeRequestGate = new Promise<void>((resolve) => {
    releaseCloseRequest = resolve;
  });
  const holdCloseRequest = async (route: Route) => {
    closeRequestIntercepted = true;
    await closeRequestGate;
    await route.continue();
  };
  await page.route("**/rpc/closeWork", holdCloseRequest);

  const firstStatus = firstWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await firstStatus.selectOption("Closed");
  const firstClose = firstWork.getByRole("dialog", {
    name: CLOSE_DIALOG_NAME,
  });
  await firstClose.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(() => closeRequestIntercepted).toBe(true);
  await expect(
    firstWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    firstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  releaseCloseRequest?.();
  await expect(
    firstWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    firstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toBeVisible();
  await page.unroute("**/rpc/closeWork", holdCloseRequest);

  const firstEffect = firstWork.locator(
    '.work-completion-effect[data-playing="true"]',
  );
  await expect(firstEffect).toHaveAttribute("aria-hidden", "true");
  await expect(firstEffect).toHaveCSS("pointer-events", "none");
  const secondStatus = secondWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await secondStatus.selectOption("Closed");
  const secondCloseDialog = secondWork.getByRole("dialog", {
    name: CLOSE_DIALOG_NAME,
  });
  await expect(secondCloseDialog).toBeVisible();
  await expect(firstEffect).toHaveCount(1);
  await secondCloseDialog
    .getByRole("button", { name: "Return to work", exact: true })
    .click();

  await page.clock.fastForward(1200);
  await expect(firstEffect).toHaveCount(0);

  await secondStatus.selectOption("Closed");
  await secondWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    secondWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    secondWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  const firstNotice = firstWork.getByRole("status");
  await expect(
    firstWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Closed");
  await firstNotice
    .getByRole("button", { name: "Reopen", exact: true })
    .click();
  const reopenDialog = firstWork.getByRole("dialog", {
    name: REOPEN_DIALOG_NAME,
  });
  await expect(reopenDialog).toBeVisible();
  await expect(
    firstWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Closed");
  await reopenDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    firstNotice.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    firstWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Closed");

  await page.clock.fastForward(28_800);
  const thirdStatus = thirdWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await thirdStatus.selectOption("Closed");
  await thirdWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    thirdWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    thirdWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toBeVisible();

  await page.clock.fastForward(30_000);
  let releaseHiddenCloseRequest: (() => void) | undefined;
  let hiddenCloseRequestIntercepted = false;
  const hiddenCloseRequestGate = new Promise<void>((resolve) => {
    releaseHiddenCloseRequest = resolve;
  });
  const holdHiddenCloseRequest = async (route: Route) => {
    hiddenCloseRequestIntercepted = true;
    await hiddenCloseRequestGate;
    await route.continue();
  };
  await page.route("**/rpc/closeWork", holdHiddenCloseRequest);

  await fourthWork
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => document.documentElement.dataset.testVisibility,
    });
    document.documentElement.dataset.testVisibility = "hidden";
  });
  await fourthWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect.poll(() => hiddenCloseRequestIntercepted).toBe(true);
  await page.evaluate(() => {
    document.documentElement.dataset.testVisibility = "visible";
  });
  releaseHiddenCloseRequest?.();
  await expect(
    fourthWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    fourthWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
  await page.unroute("**/rpc/closeWork", holdHiddenCloseRequest);

  await page.reload();
  const refreshedFirstWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: page
        .locator("p")
        .filter({ hasText: "Complete the first release task" }),
    });
  await expect(
    refreshedFirstWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    refreshedFirstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  await page.goto("/projects");
  await page.goBack();
  const historyFirstWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: page
        .locator("p")
        .filter({ hasText: "Complete the first release task" }),
    });
  await expect(
    historyFirstWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    historyFirstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  const secondTab = await context.newPage();
  await secondTab.goto(projectWorkUrl);
  const secondTabFirstWork = secondTab
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: secondTab
        .locator("p")
        .filter({ hasText: "Complete the first release task" }),
    });
  await expect(
    secondTabFirstWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    secondTabFirstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
});

test("keeps the base success notice for ten seconds when effects are off", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");

  await page.goto("/account/completion-effects");
  await expect(page.getByRole("switch", { name: "Enable" })).not.toBeChecked();

  await openProjectWorkSurface(page, "Completion Effects Base Notice Project");
  const work = await createWork(page, "Keep the base success notice visible");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));

  await work
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  await work
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();

  const notice = work.getByRole("status");
  await expect(
    notice.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(notice).toHaveAttribute("aria-live", "polite");
  await expect(
    work.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
  await expect(
    work.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Closed");

  await page.clock.fastForward(9999);
  await expect(
    notice.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(1);
  await expect(notice).toHaveCount(0);
});

test("does not replay a timed-out idempotent close or celebrate Abandoned", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setup = await signInWithAccountPreferencesFixture(
    context,
    request,
    "work-lifecycle",
  );
  await enableCompletionEffects(page);
  await openProjectWorkSurface(page, "Completion Effects Retry Project");
  const projectWorkUrl = page.url();
  const retryWork = await createWork(page, "Retry the accepted close");
  const retryStatus = retryWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await retryStatus.selectOption("Closed");

  let closeAttempts = 0;
  const closeRequestBodies: string[] = [];
  await page.route("**/rpc/closeWork", async (route) => {
    closeAttempts += 1;
    closeRequestBodies.push(route.request().postData() ?? "");
    if (closeAttempts === 1) {
      const acceptedResponse = await route.fetch();
      expect(acceptedResponse.ok()).toBe(true);
      await route.fulfill({
        body: "The response timed out after the server accepted the close.",
        contentType: "text/plain",
        status: 504,
      });
      return;
    }
    await route.continue();
  });

  const closeDialog = retryWork.getByRole("dialog", {
    name: CLOSE_DIALOG_NAME,
  });
  await closeDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(retryWork.getByRole("alert")).toBeVisible();
  await expect(
    retryWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    retryWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  await retryWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    retryWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  expect(closeRequestBodies).toHaveLength(2);
  expect(closeRequestBodies[1]).toBe(closeRequestBodies[0]);
  await expect(
    retryWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
  await expect(retryStatus).toHaveValue("Closed");
  await page.unrouteAll();

  const conflictWork = await createWork(page, "Reject a stale close");
  const conflictStatus = conflictWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await conflictStatus.selectOption("Closed");
  const conflictDialog = conflictWork.getByRole("dialog", {
    name: CLOSE_DIALOG_NAME,
  });
  const conflictTab = await context.newPage();
  await conflictTab.goto(projectWorkUrl);
  await openWorkRecordFromKanbanList(conflictTab, "Reject a stale close");
  const otherConflictWork = conflictTab
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: conflictTab.locator("p").filter({ hasText: "Reject a stale close" }),
    });
  const otherConflictStatus = otherConflictWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await otherConflictStatus.selectOption("In Progress");
  await expect(otherConflictStatus).toHaveValue("In Progress");
  await conflictDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(conflictWork.getByRole("alert")).toBeVisible();
  await expect(
    conflictWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    conflictWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
  await conflictDialog
    .getByRole("button", { name: "Return to work", exact: true })
    .click();
  await conflictTab.close();
  await page.reload();

  const backgroundWork = await createWork(
    page,
    "Complete from a server update",
  );
  const backgroundWorkElementId = await backgroundWork.getAttribute("id");
  if (!backgroundWorkElementId?.startsWith("work-")) {
    throw new Error("The background Work row did not expose its record id.");
  }
  const backgroundWorkId = decodeURIComponent(
    backgroundWorkElementId.slice("work-".length),
  );
  const accountClient = createAccountApiClient(setup.cookie);
  const openBackgroundWork = await accountClient.work({
    workId: backgroundWorkId,
  });
  const completedInBackground = await accountClient.closeWork({
    baseRevision: openBackgroundWork.revision,
    clientIdempotencyKey: crypto.randomUUID(),
    closureResult: "Completed",
    workId: backgroundWorkId,
  });
  expect(completedInBackground).toMatchObject({
    closureResult: "Completed",
    status: "Closed",
  });
  await page.reload();
  const refreshedBackgroundWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: page
        .locator("p")
        .filter({ hasText: "Complete from a server update" }),
    });
  await expect(refreshedBackgroundWork).toBeVisible();
  await expect(
    refreshedBackgroundWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    refreshedBackgroundWork.locator(
      '.work-completion-effect[data-playing="true"]',
    ),
  ).toHaveCount(0);

  const abandonedWork = await createWork(page, "Abandon without celebrating");
  await abandonedWork
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  await abandonedWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("combobox", { name: CLOSURE_RESULT_COMBOBOX_NAME })
    .selectOption("Abandoned");
  await abandonedWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    abandonedWork.getByText("Abandoned", { exact: true }),
  ).toBeVisible();
  await expect(
    abandonedWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    abandonedWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionWork = await createWork(
    page,
    "Keep the success notice without motion",
  );
  await reducedMotionWork
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  await reducedMotionWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    reducedMotionWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    reducedMotionWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
});

test("plays a new event after the same Work is reopened and completed again", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");
  await enableCompletionEffects(page);
  await openProjectWorkSurface(page, "Reopened Completion Project");
  const firstWork = await createWork(page, "Complete the reopened work");

  const firstStatus = firstWork.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await firstStatus.selectOption("Closed");
  await firstWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    firstWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    firstWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toBeVisible();

  await firstWork.getByRole("button", { name: "Reopen", exact: true }).click();
  await firstWork
    .getByRole("dialog", { name: REOPEN_DIALOG_NAME })
    .getByRole("button", { name: "Confirm reopen", exact: true })
    .click();
  await expect(firstStatus).toBeEnabled({ timeout: 20_000 });
  await expect(firstStatus).toHaveValue("Not Started");

  await page.reload();
  const reopenedWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({
      has: page.locator("p").filter({ hasText: "Complete the reopened work" }),
    });
  await expect(
    reopenedWork.getByText("Work completed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    reopenedWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toHaveCount(0);
  await expect(
    reopenedWork.getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME }),
  ).toHaveValue("Not Started");
  await reopenedWork
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  await reopenedWork
    .getByRole("dialog", { name: CLOSE_DIALOG_NAME })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    reopenedWork.getByText("Work completed", { exact: true }),
  ).toBeVisible();
  await expect(
    reopenedWork.locator('.work-completion-effect[data-playing="true"]'),
  ).toBeVisible();
});

test("shows Completion Effects feedback for a bulk Completed close", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");
  await enableCompletionEffects(page);
  await openProjectWorkSurface(page, "Bulk Completion Effects Project");
  const work = await createWork(page, "Complete through Bulk Edit");
  const workElementId = await work.getAttribute("id");
  if (!workElementId) {
    throw new Error("The selected Work row did not expose its record id.");
  }
  const workRow = page.locator(`[id="${workElementId}"]`);

  await work.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bulk Edit" }).click();
  const bulkEdit = page.getByRole("dialog", { name: "Bulk Edit" });
  await bulkEdit
    .getByRole("combobox", { name: "Status" })
    .selectOption("Closed");
  await expect(bulkEdit.getByLabel("Closure result")).toBeVisible();
  await bulkEdit.getByRole("button", { name: "Preview", exact: true }).click();
  await page.evaluate(() => {
    let frameAt = 0;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        frameAt += 16;
        callback(frameAt);
      }, 16)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((frameId: number) =>
      window.clearTimeout(frameId)) as typeof window.cancelAnimationFrame;
  });
  let activeRefreshGate: ReturnType<typeof createRequestGate> | null = null;
  await page.route("**/rpc/projectWorks", async (route) => {
    const refreshGate = activeRefreshGate;
    if (refreshGate) {
      refreshGate.notifyStarted();
      await refreshGate.wait();
    }
    await route.continue();
  });

  const bulkRefreshGate = createRequestGate();
  const finalizing = bulkEdit.getByRole("button", {
    name: "Finalizing",
    exact: true,
  });
  activeRefreshGate = bulkRefreshGate;
  try {
    await bulkEdit.getByRole("button", { name: "Apply", exact: true }).click();

    await expect(
      bulkEdit
        .getByRole("list", { name: "Bulk Edit results" })
        .getByText("Succeeded"),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      workRow.locator('[role="status"]').filter({
        hasText: "Work completed",
      }),
    ).toBeVisible();
    const effect = workRow.locator(
      '.work-completion-effect[data-playing="true"]',
    );
    await expect(effect).toBeVisible();

    await bulkRefreshGate.started;
    await bulkEdit.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(finalizing).toBeVisible();
  } finally {
    activeRefreshGate = null;
    bulkRefreshGate.release();
  }

  await expect(finalizing).toBeHidden({ timeout: 20_000 });
  await bulkEdit.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(bulkEdit).toBeHidden();
  await expect(
    workRow.locator('[role="status"]').filter({
      hasText: "Work completed",
    }),
  ).toBeVisible();
});

test("keeps the Work completed notice when the drawing budget is missed", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");
  await enableCompletionEffects(page);
  await openProjectWorkSurface(
    page,
    "Completion Effects Drawing Budget Project",
  );
  const work = await createWork(page, "Keep feedback on a slow device");
  await work
    .getByRole("combobox", { name: WORK_STATUS_COMBOBOX_NAME })
    .selectOption("Closed");
  const closeDialog = work.getByRole("dialog", { name: CLOSE_DIALOG_NAME });
  await expect(closeDialog).toBeVisible();

  await page.evaluate(() => {
    let frameAt = 0;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        frameAt += 16;
        callback(frameAt);
      }, 16)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((frameId: number) =>
      window.clearTimeout(frameId)) as typeof window.cancelAnimationFrame;
  });
  await closeDialog.getByRole("button", { name: "Close", exact: true }).click();

  await expect(work.getByText("Work completed", { exact: true })).toBeVisible();
  const effect = work.locator('.work-completion-effect[data-playing="true"]');
  await expect(effect).toBeVisible();
  await page.evaluate(() => {
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(
        () => callback(performance.now()),
        80,
      )) as typeof window.requestAnimationFrame;
  });
  await expect(effect).toHaveCount(0, { timeout: 1500 });
  await expect(work.getByText("Work completed", { exact: true })).toBeVisible();
});

test("keeps Work status controls pending until the accepted close refresh completes", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await signInWithAccountPreferencesFixture(context, request, "work-lifecycle");
  await openProjectWorkSurface(page, "Completion Effects Refresh Project");
  const work = await createWork(page, "Wait for the refreshed Work status");
  const status = work.getByRole("combobox", {
    name: WORK_STATUS_COMBOBOX_NAME,
  });
  await status.selectOption("Closed");
  const closeDialog = work.getByRole("dialog", { name: CLOSE_DIALOG_NAME });

  let activeRefreshGate: ReturnType<typeof createRequestGate> | null = null;
  await page.route("**/rpc/projectWorks", async (route) => {
    const refreshGate = activeRefreshGate;
    if (refreshGate) {
      refreshGate.notifyStarted();
      await refreshGate.wait();
    }
    await route.continue();
  });

  const closeRefreshGate = createRequestGate();
  activeRefreshGate = closeRefreshGate;
  try {
    await closeDialog
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await closeRefreshGate.started;
    await expect(status).toBeDisabled();
  } finally {
    activeRefreshGate = null;
    closeRefreshGate.release();
  }
  await expect(status).toBeEnabled();
  await expect(status).toHaveValue("Closed");

  const reopenRefreshGate = createRequestGate();
  activeRefreshGate = reopenRefreshGate;
  try {
    await work.getByRole("button", { name: "Reopen", exact: true }).click();
    await work
      .getByRole("dialog", { name: REOPEN_DIALOG_NAME })
      .getByRole("button", { name: "Confirm reopen", exact: true })
      .click();
    await reopenRefreshGate.started;
    await expect(status).toBeDisabled();
  } finally {
    activeRefreshGate = null;
    reopenRefreshGate.release();
  }
  await expect(status).toBeEnabled();
  await expect(status).toHaveValue("Not Started");
});
