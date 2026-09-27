import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PLACE_ON_PLAN_REGION_NAME_PATTERN = /Place .* on plan/;

function roadmapWork(page: Page, title: string) {
  return page.locator("#roadmap article").filter({ hasText: title });
}

async function openAllWorkRoadmap(page: Page) {
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Planning surfaces" })
    .getByRole("link", { name: "Roadmap", exact: true })
    .click();
  await page.locator("#roadmap-view").selectOption("all");
}

test("refreshes a Roadmap horizon selection after another tab changes it", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  const projectName = "Roadmap Horizon Refresh";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByLabel("Starter Configuration").selectOption("Solo SaaS");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("link", { name: projectName, exact: true }).click();
  const projectUrl = page.url();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const title = "Confirm the refreshed horizon";
  await page.getByLabel("Title").fill(title);
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/finalizeWorkDraft"),
  );
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  expect((await createResponse).ok()).toBe(true);

  await openAllWorkRoadmap(page);
  await page
    .locator("#roadmap details > summary")
    .filter({ hasText: "Unplanned candidates" })
    .click();
  const firstTabWork = roadmapWork(page, title);
  await expect(firstTabWork).toBeVisible();
  await firstTabWork.getByRole("button", { name: "Place on plan" }).click();
  const placementEditor = firstTabWork.getByRole("region", {
    name: PLACE_ON_PLAN_REGION_NAME_PATTERN,
  });
  await placementEditor
    .getByRole("combobox", { exact: true, name: "Horizon" })
    .selectOption("Later");
  await placementEditor.getByRole("button", { name: "Preview" }).click();
  await placementEditor.getByRole("button", { name: "Confirm" }).click();
  const firstTabHorizon = firstTabWork.getByRole("combobox", {
    name: "Horizon",
  });
  await expect(firstTabHorizon).toHaveValue("Later");
  await firstTabWork
    .getByRole("combobox", { name: "Horizon" })
    .selectOption("Next");

  const secondTab = await context.newPage();
  try {
    await secondTab.goto(projectUrl);
    await openAllWorkRoadmap(secondTab);
    const secondTabWork = roadmapWork(secondTab, title);
    await expect(secondTabWork).toBeVisible();
    await secondTabWork
      .getByRole("combobox", { name: "Horizon" })
      .selectOption("Now");
    const remoteHorizonUpdate = secondTab.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/rpc/updateWorkHorizon"),
    );
    await secondTabWork
      .getByRole("button", { name: "Place on horizon" })
      .click();
    expect((await remoteHorizonUpdate).ok()).toBe(true);
    await expect(
      secondTabWork.getByRole("combobox", { name: "Horizon" }),
    ).toHaveValue("Now");

    const firstTabRefresh = page.waitForResponse((response) =>
      response.url().includes("/rpc/projectWorks"),
    );
    await page.bringToFront();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await firstTabRefresh;
    await expect(
      firstTabWork.getByRole("combobox", { name: "Horizon" }),
    ).toHaveValue("Now");
  } finally {
    await secondTab.close();
  }
});
