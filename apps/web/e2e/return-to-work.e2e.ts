import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const longStatusReason = /Long in the same status/;
const agedWorkTitle = /Review payment retries/;
const documentSourceLinkName = /Open source record\s*: Returning document/;
const returningSourceLinkName = /Open source record/;
const workLinkName = /Open source record\s*: .*Investigate payments/;
const projectLinkName = /Open source record\s*: Return to Work Project/;
const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("Return to Work saves independent source hints, opens current sources, and preserves drafts after a failure", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=return-to-work`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Return to Work Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.route(
    "**/rpc/markReturnContextViewed",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page
    .getByRole("link", { name: "Return to Work Project", exact: true })
    .click();
  const projectUrl = page.url().split("#")[0] ?? page.url();
  const summary = page.getByRole("region", {
    name: "Return to Work",
    exact: true,
  });
  await expect(
    summary.getByText("The last visit could not be saved.", { exact: true }),
  ).toBeVisible();
  await summary.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    summary.getByText("The last visit could not be saved.", { exact: true }),
  ).toBeHidden();
  await summary
    .getByLabel("Next concrete step")
    .fill("Ask about payment failures");
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    summary.getByText("Next concrete step saved.", { exact: true }),
  ).toHaveText("Next concrete step saved.");
  let releaseSummary: (() => Promise<void>) | undefined;
  await page.route(
    "**/rpc/returnToWork",
    async (route) => {
      const response = await route.fetch();
      releaseSummary = () => route.fulfill({ response });
    },
    { times: 1 },
  );
  await summary
    .getByLabel("Next concrete step")
    .fill("Check payment failure logs");
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => Boolean(releaseSummary)).toBe(true);
  await expect(
    summary.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  await expect(summary.getByLabel("Next concrete step")).toBeDisabled();
  await releaseSummary?.();
  await expect(
    summary
      .getByRole("list")
      .getByText("Check payment failure logs", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .getByText("Next concrete step saved.", { exact: true })
      .last(),
  ).toBeVisible();

  await summary
    .getByLabel("Next concrete step")
    .fill("Ask about payment failures");
  const nextSave = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/saveNextConcreteStep"),
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  expect((await nextSave).ok()).toBe(true);
  await expect(
    summary.getByText("Next concrete step saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Ask about payment failures",
  );
  const repeatedSave = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/saveNextConcreteStep"),
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  expect((await repeatedSave).ok()).toBe(true);
  await expect(
    page
      .locator("[data-sonner-toast]")
      .getByText("Next concrete step saved.", { exact: true }),
  ).toBeVisible();
  const successToast = page
    .locator('[data-sonner-toast][data-type="success"]')
    .last();
  await expect(successToast).toHaveCSS("opacity", "1");
  await expect(successToast).toBeInViewport();
  await page.screenshot({ path: "../../.context/return-save-feedback.png" });
  await page.route("**/rpc/returnToWork", (route) =>
    route.fulfill({ status: 503, body: "Summary refresh unavailable" }),
  );
  await summary
    .getByLabel("Next concrete step")
    .fill("Check the saved step after a refresh failure");
  const saveBeforeRefreshFailure = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/saveNextConcreteStep"),
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saveBeforeRefreshFailure).ok()).toBe(true);
  await expect(
    summary.getByText("Return to Work is unavailable. Try loading it again.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    summary.getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/rpc/returnToWork");
  await summary.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Check the saved step after a refresh failure",
  );
  await summary
    .getByLabel("Next concrete step")
    .fill("Ask about payment failures");
  const saveAfterRefreshRetry = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/saveNextConcreteStep"),
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saveAfterRefreshRetry).ok()).toBe(true);
  await expect(
    summary
      .getByRole("list")
      .getByText("Ask about payment failures", { exact: true }),
  ).toBeVisible();
  await summary
    .getByRole("list")
    .getByRole("link", {
      name: projectLinkName,
    })
    .click();
  await expect(page).toHaveURL(`${projectUrl}#overview`);
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Ask about payment failures",
  );
  for (const projectSourceLink of [
    summary.locator("form").getByRole("link", { name: projectLinkName }),
    summary.getByRole("list").getByRole("link", { name: projectLinkName }),
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: Each click must follow scrolling away from the same source.
    await projectSourceLink.scrollIntoViewIfNeeded();
    await expect(
      page.locator("#project-overview-heading"),
    ).not.toBeInViewport();
    await projectSourceLink.click();
    await expect(page).toHaveURL(`${projectUrl}#overview`);
    await expect(page.locator("#project-overview-heading")).toBeInViewport();
  }
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const discovery = page.getByRole("dialog", { name: "Search", exact: true });
  await discovery
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("Ask about payment failures");
  await discovery
    .getByRole("link", { name: "Open Return to Work Project", exact: true })
    .click();
  await expect(discovery).toBeHidden();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Ask about payment failures",
  );
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill("Investigate payments");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Investigate payments", exact: true }),
  ).toBeVisible();
  const workHeadingId = await page
    .getByRole("heading", { name: "Investigate payments", exact: true })
    .getAttribute("id");
  expect(workHeadingId).not.toBeNull();
  const workId = workHeadingId?.slice(
    "work-context-card-".length,
    -"-heading".length,
  );
  const workUrl = `${projectUrl}#work-${workId}`;
  await page.goto(`${projectUrl}#overview`);
  await expect(
    summary.getByText("Recently edited", { exact: false }).first(),
  ).toBeVisible();
  const sourceNavigation = page
    .waitForEvent("request", {
      predicate: (navigationRequest) =>
        navigationRequest.resourceType() === "document",
      timeout: 1500,
    })
    .then(
      () => true,
      () => false,
    );
  await summary
    .getByRole("list")
    .first()
    .getByRole("link", { name: workLinkName })
    .click();
  await expect(page).toHaveURL(workUrl);
  expect(await sourceNavigation).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Investigate payments", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Investigate payments", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "../../.context/return-work-source.png" });
  await expect(summary.getByLabel("Next concrete step")).toHaveValue("");
  await summary
    .getByLabel("Next concrete step")
    .fill("Request the failing transaction");
  await page.route(
    "**/rpc/saveNextConcreteStep",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    {
      times: 1,
    },
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(summary.getByRole("alert")).toBeVisible();
  await expect(
    page.locator('[data-sonner-toast][data-type="error"]').last(),
  ).toBeVisible();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Request the failing transaction",
  );
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    summary.getByText("Next concrete step saved.", { exact: true }),
  ).toHaveText("Next concrete step saved.");
  await page.reload();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Request the failing transaction",
  );
  const activeWorkSourceLink = summary
    .locator("form")
    .getByRole("link", { name: workLinkName });
  await activeWorkSourceLink.scrollIntoViewIfNeeded();
  await activeWorkSourceLink.press("Enter");
  await expect(page).toHaveURL(workUrl);
  await expect(
    page.getByRole("heading", { name: "Investigate payments", exact: true }),
  ).toBeInViewport();
  await summary.getByLabel("Next concrete step").fill("");
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    summary.getByText("Next concrete step saved.", { exact: true }),
  ).toHaveText("Next concrete step saved.");
  await page.reload();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue("");
  await page.goto(`${projectUrl}#overview`);
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Ask about payment failures",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Return to Work"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  let releaseVisit: (() => Promise<void>) | undefined;
  await page.route(
    "**/rpc/markReturnContextViewed",
    (route) => {
      releaseVisit = () =>
        route.fulfill({ status: 503, body: "Delayed visit failure" });
    },
    { times: 1 },
  );
  await summary
    .getByRole("list")
    .first()
    .getByRole("link", { name: workLinkName })
    .click();
  await expect.poll(() => Boolean(releaseVisit)).toBe(true);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Ask about payment failures",
  );
  await releaseVisit?.();
  await expect(
    summary.getByText("The last visit could not be saved.", { exact: true }),
  ).toBeHidden();
  await summary.screenshot({
    path: "../../.context/return-to-work.png",
  });
});

test("Since you last looked keeps visible changes until reopening and opens their source", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=return-to-work`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Since Last Looked Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  const firstVisit = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page
    .getByRole("link", { name: "Since Last Looked Project", exact: true })
    .click();
  expect((await firstVisit).ok()).toBe(true);
  const changes = page.getByRole("region", {
    name: "Since you last looked",
    exact: true,
  });
  await expect(
    changes.getByText("Changes will appear after your next visit."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Inspect returning context");
  const workVisits: string[] = [];
  page.on("request", (visitRequest) => {
    if (visitRequest.url().endsWith("/rpc/markReturnContextViewed")) {
      workVisits.push(visitRequest.postData() ?? "");
    }
  });
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const heading = page.getByRole("heading", {
    name: "Inspect returning context",
    exact: true,
  });
  await expect(heading).toBeVisible();
  const workId = (await heading.getAttribute("id"))?.slice(
    "work-context-card-".length,
    -"-heading".length,
  );
  const [projectUrl] = page.url().split("#");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Unopened returning context");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Unopened returning context",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`${projectUrl}#work-relations-${workId}`);
  await expect(
    page.getByRole("list", { name: "Work list", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Return to Work", exact: true }),
  ).toHaveCount(0);
  expect(workVisits).toEqual([]);
  const workVisit = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page.goto(`${projectUrl}#work-${workId}`);
  expect((await workVisit).ok()).toBe(true);
  expect(workVisits).toHaveLength(1);
  expect(workVisits[0]).toContain(workId ?? "");
  await expect(
    page.getByRole("region", { name: "Return to Work", exact: true }),
  ).toHaveCount(1);
  const summary = page.getByRole("region", {
    name: "Return to Work",
    exact: true,
  });
  await summary.getByLabel("Next concrete step").fill("Read payment logs");
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    changes.getByText("Work updated", { exact: true }),
  ).toBeVisible();
  await expect(changes.locator("time")).toHaveCount(1);
  await changes
    .getByRole("link", { name: returningSourceLinkName })
    .press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Inspect returning context",
      exact: true,
    }),
  ).toBeInViewport();
  const nextVisit = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page.reload();
  expect((await nextVisit).ok()).toBe(true);
  await expect(
    changes.getByText("Work updated", { exact: true }),
  ).toBeVisible();
  await changes.screenshot({ path: "../../.context/since-last-looked.png" });
  await page.reload();
  await expect(
    changes.getByText("No changes since your last visit."),
  ).toBeVisible();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue(
    "Read payment logs",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Since you last looked"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("Since you last looked opens a Document after its area is hidden", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  const projectUrl = `/projects/${setup.projectId}`;
  const visit = page.waitForResponse((visitResponse) =>
    visitResponse.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page.goto(`${projectUrl}#overview`);
  expect((await visit).ok()).toBe(true);
  await page.goto(`${projectUrl}#documents`);
  await page
    .getByRole("region", { name: "Documents", exact: true })
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title").fill("Returning document");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Returning document");
  await page.goto(`${projectUrl}#overview`);
  const changes = page.getByRole("region", {
    name: "Since you last looked",
    exact: true,
  });
  const sourceLink = changes.getByRole("link", {
    name: documentSourceLinkName,
  });
  const sourceHref = await sourceLink.getAttribute("href");
  expect(sourceHref).not.toBeNull();
  await sourceLink.press("Enter");
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Returning document");
  await page
    .getByRole("button", { name: "Configuration Mode", exact: true })
    .click();
  const configuration = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configuration
    .locator("#configuration-host-project-areas")
    .getByRole("button", { name: "Hide Documents", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exit Configuration Mode", exact: true })
    .click();
  await page.goto(sourceHref ?? "");
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Returning document");
});

test("optional Project status-age threshold shows neutral return cards and a live prepared collection", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=long-status`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}`);
  const summary = page.getByRole("region", {
    name: "Return to Work",
    exact: true,
  });
  await expect(summary.getByText(longStatusReason)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configuration Mode", exact: true })
    .click();
  const configuration = page.getByRole("region", {
    name: "Configuration Mode",
    exact: true,
  });
  await configuration
    .getByRole("button", { name: "Saved views", exact: true })
    .click();
  await configuration
    .getByLabel("Long in the same status", { exact: true })
    .fill("0");
  await expect(
    configuration.getByRole("button", {
      name: "Save Long in the same status",
      exact: true,
    }),
  ).toBeDisabled();
  await configuration
    .getByLabel("Long in the same status", { exact: true })
    .fill("7");
  await configuration
    .getByRole("button", { name: "Save Long in the same status", exact: true })
    .click();
  await expect(
    configuration.getByRole("button", {
      name: "Save Long in the same status",
      exact: true,
    }),
  ).toBeDisabled();
  await page.reload();
  await configuration
    .getByRole("button", { name: "Saved views", exact: true })
    .click();
  await expect(
    configuration.getByLabel("Long in the same status", { exact: true }),
  ).toHaveValue("7");
  await page
    .getByRole("button", { name: "Exit Configuration Mode", exact: true })
    .click();
  await page.goto(`/projects/${setup.projectId}#overview`);
  await expect(summary.getByText(longStatusReason)).toBeVisible();
  await page.goto(`/projects/${setup.projectId}#smart-collections`);
  await expect(
    page.getByRole("heading", { name: "Long in the same status · Default" }),
  ).toBeVisible();
  await expect(page.getByText(agedWorkTitle).first()).toBeVisible();
  await expect(page.getByText("Subscribe", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configuration Mode", exact: true })
    .click();
  await configuration
    .getByRole("button", { name: "Saved views", exact: true })
    .click();
  await configuration
    .getByLabel("Long in the same status", { exact: true })
    .fill("");
  await configuration
    .getByRole("button", { name: "Save Long in the same status", exact: true })
    .click();
  await expect(
    configuration.getByRole("button", {
      name: "Save Long in the same status",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Exit Configuration Mode", exact: true })
    .click();
  await page.goto(`/projects/${setup.projectId}#overview`);
  await expect(summary.getByText(longStatusReason)).toHaveCount(0);
});
