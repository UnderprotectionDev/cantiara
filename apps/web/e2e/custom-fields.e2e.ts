import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;

const FIELD_TYPES = [
  "Text",
  "Number",
  "Boolean",
  "Date",
  "Single select",
  "Multi select",
] as const;

const RECORD_TYPES = [
  "Work",
  "Feedback",
  "User Research Session",
  "Risk",
  "Assumption",
  "Decision",
  "Test Handoff",
  "Test Session",
  "Planned Test Scenario",
  "Test Gap",
  "Production Incident",
  "Milestone",
  "Project Release",
] as const;

test("defines the closed Project Custom Fields matrix in Configuration Mode", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=custom-fields`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  const projectName = "Project Custom Fields Acceptance";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);

  await page.getByRole("button", { name: "Configuration Mode" }).click();
  const configurationRegion = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configurationRegion
    .getByRole("button", { name: "Custom field", exact: true })
    .click();
  const customFieldHost = configurationRegion.getByRole("region", {
    exact: true,
    name: "Custom field",
  });
  await expect(customFieldHost).toBeVisible();

  const typeSelect = customFieldHost.getByLabel("Type");
  await expect(typeSelect.locator("option")).toHaveText(FIELD_TYPES);
  await Promise.all(
    RECORD_TYPES.map((recordType) =>
      expect(
        customFieldHost.getByRole("checkbox", { name: recordType }),
      ).toBeVisible(),
    ),
  );
  await Promise.all(
    [
      "Lookup",
      "Formula",
      "Session Test",
      "Test assessment",
      "Markdown body",
      "Raw attachment",
      "Tag hierarchy",
      "Rename Tag",
      "Merge tags",
    ].map((forbidden) =>
      expect(customFieldHost.getByText(forbidden, { exact: true })).toHaveCount(
        0,
      ),
    ),
  );

  async function defineFields(
    types: readonly (typeof FIELD_TYPES)[number][],
  ): Promise<void> {
    const [type, ...remaining] = types;
    if (!type) {
      return;
    }

    await customFieldHost.getByLabel("Field name").fill(`${type} field`);
    await typeSelect.selectOption(type);
    if (type === "Single select" || type === "Multi select") {
      await customFieldHost.getByLabel("Options").fill("Ready\nLater");
    }
    await customFieldHost.getByRole("checkbox", { name: "Work" }).check();
    await customFieldHost.getByRole("checkbox", { name: "Feedback" }).check();
    const response = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.url().endsWith("/rpc/createCustomField") &&
        candidate.ok(),
    );
    await customFieldHost
      .getByRole("button", { name: "Add custom field" })
      .click();
    await response;
    await expect(
      customFieldHost.getByText(`${type} field`, { exact: true }),
    ).toBeVisible();

    await defineFields(remaining);
  }

  await defineFields(FIELD_TYPES);

  await expect(
    customFieldHost.getByText("Available on: Work, Feedback", { exact: true }),
  ).toHaveCount(6);

  const activeItems = customFieldHost.getByRole("list").first();
  const trashItems = customFieldHost.getByRole("list").last();

  await activeItems
    .getByRole("listitem")
    .filter({ hasText: "Text field" })
    .getByRole("button", { name: "Edit" })
    .click();
  const editForm = customFieldHost.getByRole("form", {
    name: "Edit Text field",
  });
  await editForm.getByLabel("Field name").fill("Renamed field");
  await editForm.getByRole("button", { name: "Save" }).click();
  await expect(
    customFieldHost.getByText("Renamed field", { exact: true }),
  ).toBeVisible();

  await activeItems
    .getByRole("listitem")
    .filter({ hasText: "Number field" })
    .getByRole("button", { name: "Move to Trash" })
    .click();
  await expect(
    activeItems.getByRole("listitem").filter({ hasText: "Number field" }),
  ).toHaveCount(0);
  await expect(
    customFieldHost.getByRole("heading", { name: "Trash" }),
  ).toBeVisible();
  await expect(
    trashItems.getByRole("listitem").filter({ hasText: "Number field" }),
  ).toHaveCount(1);

  await trashItems
    .getByRole("listitem")
    .filter({ hasText: "Number field" })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(
    activeItems.getByRole("listitem").filter({ hasText: "Number field" }),
  ).toHaveCount(1);
  await expect(
    customFieldHost.getByText("Available on: Work, Feedback", { exact: true }),
  ).toHaveCount(6);
});
