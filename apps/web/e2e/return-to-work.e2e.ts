import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
  await page.goto(projectUrl);
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
  await summary.getByRole("link", { name: workLinkName }).click();
  await expect(page).toHaveURL(workUrl);
  expect(await sourceNavigation).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Investigate payments", exact: true }),
  ).toBeVisible();
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
  await summary.getByLabel("Next concrete step").fill("");
  await summary.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    summary.getByText("Next concrete step saved.", { exact: true }),
  ).toHaveText("Next concrete step saved.");
  await page.reload();
  await expect(summary.getByLabel("Next concrete step")).toHaveValue("");
  await page.goto(projectUrl);
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
  await summary.getByRole("link", { name: workLinkName }).click();
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
