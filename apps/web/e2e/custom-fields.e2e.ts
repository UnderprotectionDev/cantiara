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

test("renders bound Custom field values on Work create and edit surfaces", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=custom-fields`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Custom Field Values");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page
    .getByRole("link", { name: "Custom Field Values", exact: true })
    .click();
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
  const typeSelect = customFieldHost.getByLabel("Type");

  async function defineField({
    name,
    recordType,
    type,
  }: {
    name: string;
    recordType: (typeof RECORD_TYPES)[number];
    type: (typeof FIELD_TYPES)[number];
  }) {
    await customFieldHost.getByLabel("Field name").fill(name);
    await typeSelect.selectOption(type);
    if (type === "Single select" || type === "Multi select") {
      await customFieldHost.getByLabel("Options").fill("Ready\nLater");
    }
    await customFieldHost.getByRole("checkbox", { name: recordType }).check();
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
      customFieldHost.getByText(name, { exact: true }),
    ).toBeVisible();
  }

  await defineField({
    name: "Audience",
    recordType: "Work",
    type: "Text",
  });
  await defineField({
    name: "Reviewed",
    recordType: "Work",
    type: "Boolean",
  });
  await defineField({
    name: "Review state",
    recordType: "Work",
    type: "Single select",
  });
  await defineField({
    name: "Work score",
    recordType: "Work",
    type: "Number",
  });
  await defineField({
    name: "Risk severity",
    recordType: "Risk",
    type: "Number",
  });

  await page.getByRole("button", { name: "Configuration Mode" }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();

  const workCreate = page.locator("#work-create");
  await expect(workCreate.getByLabel("Audience")).toBeVisible();
  const reviewedCheckbox = workCreate.getByRole("checkbox", {
    name: "Reviewed",
  });
  await expect(reviewedCheckbox).toBeVisible();
  await expect(workCreate.getByLabel("Review state")).toBeVisible();
  await expect(workCreate.getByLabel("Work score")).toBeVisible();
  await expect(workCreate.getByLabel("Risk severity")).toHaveCount(0);

  await workCreate.getByLabel("Title").fill("Evaluate audience fit");
  await workCreate.getByLabel("Audience").fill("Founders");
  await reviewedCheckbox.click();
  await expect(reviewedCheckbox).toBeChecked();
  await reviewedCheckbox.click();
  await expect(reviewedCheckbox).not.toBeChecked();
  await workCreate.getByLabel("Review state").selectOption("Ready");
  await workCreate.getByRole("button", { name: "Create", exact: true }).click();

  await expect(
    page.getByText("Work CUS-1 created.", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  const work = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem");
  await expect(work.getByLabel("Audience")).toHaveValue("Founders");
  await expect(work.getByLabel("Reviewed")).toHaveValue("false");
  await expect(work.getByLabel("Review state")).toHaveValue("Ready");
  await expect(work.getByLabel("Risk severity")).toHaveCount(0);
  await expect(work).toContainText("False");
  await expect(work).toContainText("Not evaluated");

  const setAudienceResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/setCustomFieldValue") &&
      candidate.ok(),
  );
  await work.getByLabel("Audience").fill("Operators");
  await work.getByLabel("Audience").press("Tab");
  await setAudienceResponse;

  const setReviewedResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/setCustomFieldValue") &&
      candidate.ok(),
  );
  await work.getByLabel("Reviewed").selectOption("true");
  await setReviewedResponse;

  const setReviewStateResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/setCustomFieldValue") &&
      candidate.ok(),
  );
  await work.getByLabel("Review state").selectOption("Later");
  await setReviewStateResponse;

  await page.reload();
  const reloadedWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem");
  await expect(reloadedWork.getByLabel("Audience")).toHaveValue("Operators");
  await expect(reloadedWork.getByLabel("Reviewed")).toHaveValue("true");
  await expect(reloadedWork.getByLabel("Review state")).toHaveValue("Later");

  // Draft autosave keeps Custom field values as form state: a refresh does
  // not wipe them and Resume restores them into the Work draft form.
  const workCreateForm = page.locator("#work-create");
  await workCreateForm.getByLabel("Title").fill("Draft persistence check");
  await workCreateForm.getByLabel("Audience").fill("Resume check");
  await workCreateForm
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved." }),
  ).toBeVisible();

  await page.reload();
  await page
    .getByRole("list", { name: "Drafts" })
    .getByRole("listitem")
    .filter({ hasText: "Draft persistence check" })
    .getByRole("button", { name: "Resume" })
    .click();
  await expect(workCreateForm.getByLabel("Audience")).toHaveValue(
    "Resume check",
  );

  await workCreateForm
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.getByText("Work CUS-2 created.", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  const persistedWork = page
    .getByRole("list", { name: "Work list" })
    .getByRole("listitem")
    .filter({ hasText: "Draft persistence check" });
  await expect(persistedWork.getByLabel("Audience")).toHaveValue(
    "Resume check",
  );
});
