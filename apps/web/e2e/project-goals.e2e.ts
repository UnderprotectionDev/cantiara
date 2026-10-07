import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const FORBIDDEN_GOAL_OUTPUT = /Key Result|progress|health|\d+%/;
const GOAL_URL = /#project-goal-/;
test("Project Goals remain optional and preserve founder outcomes through create, edit, cancel, retry, and reload", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-goals`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Project Goals Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Project Goals Acceptance", exact: true })
    .click();
  await expect(
    page.getByText("No Project Goals recorded yet.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open source record: Goals", exact: true })
    .click();
  await page.getByRole("button", { name: "New Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Useful first release");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Help founders keep context.");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Project Goal saved.")).toBeVisible();
  await page
    .getByRole("link", { name: "Useful first release", exact: true })
    .click();
  await expect(page).toHaveURL(GOAL_URL);
  await expect(
    page.getByRole("region", { name: "Project Goal", exact: true }),
  ).toContainText("Intended outcome");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Useful first release", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Project Goal" }).click();
  await page.getByLabel("Intended outcome").fill("Learn what founders need.");
  await page
    .getByLabel("Observed outcome / learning")
    .fill("Small scope helped.");
  await page.route(
    "**/rpc/updateProjectGoal",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Project Goal could not be saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Observed outcome / learning")).toHaveValue(
    "Small scope helped.",
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Project Goal saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Small scope helped.", { exact: true }),
  ).toBeVisible();
  const goalRegion = page.getByRole("region", {
    name: "Project Goal",
    exact: true,
  });
  await expect(goalRegion).not.toContainText(FORBIDDEN_GOAL_OUTPUT);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Project Goal"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Edit Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Unsaved title");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Useful first release", exact: true }),
  ).toBeVisible();
  const otherPage = await context.newPage();
  await otherPage.goto(page.url());
  await page.getByRole("button", { name: "Edit Project Goal" }).click();
  await page
    .getByLabel("Observed outcome / learning")
    .fill("Uncommitted learning");
  await otherPage.getByRole("button", { name: "Edit Project Goal" }).click();
  await otherPage
    .getByLabel("Observed outcome / learning")
    .fill("Another window learning");
  await otherPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(otherPage.getByText("Project Goal saved.")).toBeVisible();
  await page.bringToFront();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Conflict" }),
  ).toBeVisible();
  await expect(page.getByLabel("Observed outcome / learning")).toHaveValue(
    "Uncommitted learning",
  );
  await expect(
    page.getByRole("region", { name: "Current value", exact: true }),
  ).toContainText("Another window learning");
  await otherPage.close();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Another window learning", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Useful first release", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "New Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Response lost Goal");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Saved before response loss.");
  await page.route(
    "**/rpc/createProjectGoal",
    async (route) => {
      const savedResponse = await route.fetch();
      expect(savedResponse.ok()).toBe(true);
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Project Goal could not be saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "New Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Independent next Goal");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A separate founder outcome.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Independent next Goal", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Response lost Goal", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Independent next Goal", exact: true }),
  ).toHaveCount(1);
});
