import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PLACE_ON_PLAN = /Place .* on plan/;

test("tours the same changes on the live Roadmap and restores viewport and keyboard focus", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${SERVER_URL}/__e2e/setup?fixture=return-to-work`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Visual Changes Project");
  await page.getByLabel("Starter Configuration").selectOption("Solo SaaS");
  await page.getByRole("button", { name: "Create Project" }).click();
  const visited = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page
    .getByRole("link", { name: "Visual Changes Project", exact: true })
    .click();
  expect((await visited).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Tour the visual changes" }),
  ).toBeHidden();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Inspect exact visual target");
  await page.getByLabel("Type", { exact: true }).selectOption("Research");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Inspect exact visual target",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Planning surfaces" })
    .getByRole("link", { name: "Roadmap", exact: true })
    .click();
  await page
    .locator("#roadmap details > summary")
    .filter({ hasText: "Unplanned candidates" })
    .click();
  const work = page
    .locator("#roadmap article")
    .filter({ hasText: "Inspect exact visual target" });
  await work.getByRole("button", { name: "Place on plan" }).click();
  const placement = work.getByRole("region", { name: PLACE_ON_PLAN });
  await placement
    .getByRole("combobox", { name: "Horizon", exact: true })
    .selectOption("Now");
  await placement.getByRole("button", { name: "Preview", exact: true }).click();
  await placement.getByRole("button", { name: "Confirm", exact: true }).click();
  const canvas = page.getByRole("region", {
    name: "Roadmap canvas",
    exact: true,
  });
  await expect(canvas.locator(".react-flow__node")).toHaveCount(1);
  await canvas.getByRole("button", { name: "Zoom out", exact: true }).click();
  const viewport = await canvas
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  const changes = page.getByRole("region", {
    name: "Since you last looked",
    exact: true,
  });
  await expect(changes.getByRole("listitem")).toHaveCount(2);
  const rowTime = await changes
    .locator("time")
    .first()
    .getAttribute("datetime");
  const rowsBefore = await changes.getByRole("listitem").allTextContents();
  const currentUrl = page.url();
  let returnReads = 0;
  page.on("request", (read) => {
    if (read.url().endsWith("/rpc/returnToWork")) {
      returnReads += 1;
    }
  });
  const trigger = changes.getByRole("button", {
    name: "Tour the visual changes",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Tour the visual changes",
    exact: true,
  });
  await expect(
    dialog.getByText("Current visual change", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("time")).toHaveAttribute(
    "datetime",
    rowTime ?? "",
  );
  await expect(
    dialog.getByText("Work created since your last visit.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Next change", exact: true }),
  ).toBeEnabled();
  expect(page.url()).toBe(currentUrl);
  expect(returnReads).toBe(0);
  await dialog
    .getByRole("button", { name: "Next change", exact: true })
    .click();
  await expect(
    dialog.getByText("Work updated since your last visit.", { exact: true }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(
    dialog.getByRole("heading", {
      name: "Tour the visual changes",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator('[data-sonner-toast][data-type="error"]'),
  ).toBeHidden({ timeout: 10_000 });
  await page.screenshot({ path: "../../.context/issue-295-visual-tour.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await changes.getByRole("listitem").allTextContents()).toEqual(
    rowsBefore,
  );
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Planning surfaces" })
    .getByRole("link", { name: "Roadmap", exact: true })
    .click();
  await expect(canvas.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    viewport ?? "",
  );
  await expect(
    canvas.getByText("Current visual change", { exact: true }),
  ).toBeHidden();
});

test("explains skipped current-view targets and opens the capped remainder in the existing list", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${SERVER_URL}/__e2e/setup?fixture=return-to-work`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Visual Tour Remainder");
  await page.getByRole("button", { name: "Create Project" }).click();
  const visited = page.waitForResponse((response) =>
    response.url().endsWith("/rpc/markReturnContextViewed"),
  );
  await page
    .getByRole("link", { name: "Visual Tour Remainder", exact: true })
    .click();
  expect((await visited).ok()).toBe(true);
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Unplanned exact target");
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unplanned exact target", exact: true }),
  ).toBeVisible();
  // A large summary fixture at the product boundary, retaining the real source and target.
  // Both the rendered list and driver receive this single response.
  await page.route(
    "**/rpc/returnToWork",
    async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const summary = payload.json;
      const [event] = summary.sinceLastLooked.groups[0].events;
      summary.sinceLastLooked.groups = [
        {
          name: "Work",
          events: Array.from({ length: 23 }, (_, index) => ({
            ...event,
            id: `cap-event-${index}`,
          })),
        },
      ];
      await route.fulfill({ response, json: payload });
    },
    { times: 1 },
  );
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  const changes = page.getByRole("region", {
    name: "Since you last looked",
    exact: true,
  });
  await expect(changes.getByRole("listitem")).toHaveCount(23);
  const trigger = changes.getByRole("button", {
    name: "Tour the visual changes",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Tour the visual changes",
    exact: true,
  });
  await expect(
    dialog.getByText(
      "Skipped: this target cannot be placed in the current view.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    dialog.getByText("3 more visual changes", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Up to 20 visual changes", { exact: false }),
  ).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "Open remaining changes in list",
      exact: true,
    })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#return-event-cap-event-20")).toBeFocused();
  await expect(changes.getByRole("listitem")).toHaveCount(23);
  await trigger.click();
  await expect(
    dialog.getByRole("button", { name: "Close tour", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close tour", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
