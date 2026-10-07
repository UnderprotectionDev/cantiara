import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const workLinkName = /Open source record\s*: .*Investigate payments/;
const workRoute = /#work-/;
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
  await page.reload();
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
  await page.goto(projectUrl);
  await expect(
    summary.getByText("Recently edited", { exact: false }).first(),
  ).toBeVisible();
  await summary.getByRole("link", { name: workLinkName }).click();
  await expect(page).toHaveURL(workRoute);
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
  await summary.screenshot({
    path: "../../.context/return-to-work.png",
  });
});
