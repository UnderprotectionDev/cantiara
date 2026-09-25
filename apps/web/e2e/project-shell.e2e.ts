import { buildWorkspaceOverview } from "@cantiara/api/workspace-overview";
import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const CONFIGURATION_MODE_URL_PATTERN = /#configuration$/;
const WORK_HASH_PATTERN = /#work$/;
const WORK_CREATE_HASH_PATTERN = /#work-create$/;
const PRIORITY_MAP_URL_PATTERN = /#priority-map$/;
const DOCUMENTS_HASH_PATTERN = /#documents$/;
const ALL_PROJECT_AREAS = [
  "Work",
  "Documents",
  "Discovery",
  "Decisions",
  "Design",
  "Technical Diagrams",
  "Tests",
  "Releases",
  "Production",
  "GitHub",
] as const;

async function expectNoSampleContent(page: Page) {
  await expect(
    page.locator("#work").getByText("No sample content was created.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator("#documents").getByText("No sample content was created.", {
      exact: true,
    }),
  ).toBeVisible();
}

async function expectDailyActions(page: Page) {
  await Promise.all(
    ["Create", "Edit", "Status", "Planning"].map((action) =>
      expect(
        page.getByRole("link", { name: action, exact: true }),
      ).toBeVisible(),
    ),
  );
}

const STARTER_CONFIGURATION_CASES = [
  {
    configuration: "Blank Project",
    areas: ["Work", "Documents"],
    extraPinnedAreas: [],
    stages: [],
    views: ["Backlog", "Board", "List"],
  },
  {
    configuration: "Solo SaaS",
    areas: [
      "Work",
      "Documents",
      "Discovery",
      "Decisions",
      "Design",
      "Technical Diagrams",
      "Tests",
      "Releases",
      "Production",
      "GitHub",
    ],
    extraPinnedAreas: ["Discovery", "Decisions", "Design", "Tests", "Releases"],
    stages: ["Discovery", "Design", "Build", "Validate", "Release", "Operate"],
    views: ["Backlog", "Board", "List", "Roadmap"],
  },
  {
    configuration: "Open Source Library",
    areas: [
      "Work",
      "Documents",
      "Decisions",
      "Technical Diagrams",
      "Tests",
      "Releases",
      "GitHub",
    ],
    extraPinnedAreas: ["GitHub", "Tests", "Releases"],
    stages: ["Scope", "Build", "Validate", "Release", "Maintain"],
    views: ["Backlog", "Board", "List", "Roadmap"],
  },
  {
    configuration: "Mobile Application",
    areas: [
      "Work",
      "Documents",
      "Discovery",
      "Decisions",
      "Design",
      "Technical Diagrams",
      "Tests",
      "Releases",
      "Production",
      "GitHub",
    ],
    extraPinnedAreas: [
      "Discovery",
      "Design",
      "Tests",
      "Releases",
      "Production",
    ],
    stages: ["Discovery", "Design", "Build", "Validate", "Release", "Operate"],
    views: ["Backlog", "Board", "List", "Roadmap"],
  },
] as const;

test("places Projects before a loaded Workspace overview", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.route("**/rpc/workspaceOverview**", (route) =>
    route.fulfill({
      json: { json: buildWorkspaceOverview({ projects: [] }) },
    }),
  );
  await page.goto("/projects");

  const projectList = page.getByRole("region", { name: "Your Projects" });
  const workspaceOverview = page.getByRole("region", {
    name: "Workspace overview",
  });
  await expect(projectList).toBeVisible();
  await expect(workspaceOverview).toBeVisible();
  const customization = workspaceOverview.locator(
    'details[data-workspace-overview-customization="true"]',
  );
  await expect(customization.locator("summary")).toHaveText(
    "Customize overview",
  );
  await expect(customization).not.toHaveAttribute("open", "");
  await expect(
    workspaceOverview.locator('[data-workspace-overview-layout="true"]'),
  ).toBeHidden();
  await expect(
    workspaceOverview.locator('[data-workspace-overview-live-blocks="true"]'),
  ).toBeHidden();
  await expect(
    workspaceOverview.locator('[data-workspace-overview-saved-lists="true"]'),
  ).toBeHidden();
  await Promise.all(
    ["active-projects", "attention-required", "upcoming", "recent-work"].map(
      (module) =>
        expect(
          workspaceOverview.locator(
            `[data-workspace-overview-module="${module}"]`,
          ),
        ).toBeVisible(),
    ),
  );
  await expect(
    workspaceOverview.getByRole("link", {
      exact: true,
      name: "Active Projects",
    }),
  ).toBeVisible();
  await customization.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(customization).toHaveAttribute("open", "");
  await expect(
    workspaceOverview.locator('[data-workspace-overview-layout="true"]'),
  ).toBeVisible();
  await expect(
    workspaceOverview.locator('[data-workspace-overview-live-blocks="true"]'),
  ).toBeVisible();
  await expect(
    workspaceOverview.locator('[data-workspace-overview-saved-lists="true"]'),
  ).toBeVisible();
  const projectListPrecedesOverview = await projectList.evaluate((list) => {
    const overview = document.querySelector("#workspace-overview");
    return Boolean(
      overview &&
        list.compareDocumentPosition(overview) ===
          Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(projectListPrecedesOverview).toBe(true);
  await expect(
    workspaceOverview.getByRole("link", {
      exact: true,
      name: "Active Projects",
    }),
  ).toBeVisible();
});

test("creates Projects with suggested and Workspace-unique Short codes", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
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
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await expect(
    page.getByRole("heading", { name: "Create a Project", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Project Shell", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Starter Configuration")).toHaveValue(
    "Blank Project",
  );
  await expect(
    page.getByLabel("Starter Configuration").locator("option"),
  ).toHaveText([
    "Blank Project",
    "Solo SaaS",
    "Open Source Library",
    "Mobile Application",
  ]);
  await expect(page.getByLabel("Short code")).toHaveCount(0);

  await page.getByLabel("Project Name").fill("Payment App");
  await page.getByRole("button", { name: "Create Project" }).click();

  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();
  const projectList = page.getByRole("region", { name: "Your Projects" });
  const workspaceOverviewError = page
    .getByRole("alert")
    .filter({ hasText: "Workspace overview is unavailable." });
  await expect(projectList).toBeVisible();
  await expect(workspaceOverviewError).toBeVisible();
  await expect(workspaceOverviewError).toContainText(
    "Your Projects are still available above.",
  );
  const projectListPrecedesOverviewError = await projectList.evaluate(
    (list) => {
      const siblings = Array.from(list.parentElement?.children ?? []);
      const projectListIndex = siblings.indexOf(list);
      const overviewErrorIndex = siblings.findIndex(
        (element) => element.getAttribute("role") === "alert",
      );
      return projectListIndex >= 0 && overviewErrorIndex > projectListIndex;
    },
  );
  expect(projectListPrecedesOverviewError).toBe(true);
  await expect(page.getByText("Project Shell", { exact: true })).toHaveCount(0);
  const firstProject = page
    .getByRole("listitem")
    .filter({ hasText: "Payment App" });
  await expect(firstProject).toContainText("Active");
  await expect(firstProject).toContainText("Blank Project");
  await expect(firstProject.getByText("PAY", { exact: true })).toBeVisible();
  await expect(
    firstProject.getByRole("textbox", { name: "Short code" }),
  ).toHaveCount(0);
  await firstProject
    .getByRole("button", { name: "Edit Short code", exact: true })
    .click();
  const firstShortCode = firstProject.getByRole("textbox", {
    name: "Short code",
  });
  await expect(firstShortCode).toHaveValue("PAY");

  await firstShortCode.fill("DRAFT");
  await firstProject.getByRole("button", { name: "Cancel" }).click();
  await expect(firstShortCode).toHaveCount(0);
  await expect(firstProject.getByText("PAY", { exact: true })).toBeVisible();
  await firstProject
    .getByRole("button", { name: "Edit Short code", exact: true })
    .click();
  await expect(firstShortCode).toHaveValue("PAY");

  await firstShortCode.fill("PAYS");
  await firstProject.getByRole("button", { name: "Save Short code" }).click();
  await expect(firstShortCode).toHaveCount(0);
  await expect(firstProject.getByText("PAYS", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Payment App", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const workCreate = page.locator("#work-create");
  await workCreate.getByLabel("Title").fill("First Work locks short code");
  const firstWorkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/finalizeWorkDraft"),
  );
  await workCreate.getByRole("button", { name: "Create", exact: true }).click();
  expect((await firstWorkResponse).ok()).toBe(true);
  await expect(
    page
      .locator('ul[aria-label="Work list"] > li')
      .filter({ hasText: "First Work locks short code" }),
  ).toBeVisible();

  await page.goto("/projects");
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await expect(
    firstProject.getByText("Short code is locked after the first Work.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    firstProject.getByRole("button", {
      name: "Edit Short code",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(firstProject.getByText("PAYS", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Create Project" }).click();
  await page.getByText("Optional profile details", { exact: true }).click();
  await page.getByLabel("Logo").setInputFiles({
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
    mimeType: "image/png",
    name: "logo.png",
  });
  await page.getByLabel("Project Name").fill("Payment Reports");
  await page.getByRole("button", { name: "Create Project" }).click();

  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  const secondProject = page
    .getByRole("listitem")
    .filter({ hasText: "Payment Reports" });
  await expect(secondProject.getByText("PAY-2", { exact: true })).toBeVisible();
});

test("keeps Project Shell stable while toggling Configuration Mode", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  const projectName = "Configuration Mode Acceptance";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  const nonGetRequests: string[] = [];
  page.on("request", (pageRequest) => {
    if (pageRequest.method() !== "GET") {
      nonGetRequests.push(pageRequest.url());
    }
  });
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);
  const configurationMode = page.getByRole("button", {
    name: "Configuration Mode",
    exact: true,
  });
  await expect(configurationMode).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("heading", { name: projectName, level: 1 }),
  ).toBeVisible();
  await expect(
    page.locator("main > header").getByText("Active", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Blank Project", { exact: true })).toBeVisible();
  const overview = page.locator('[data-project-overview="true"]');
  await overview.locator('[data-overview-area-entry="Work"]').click();
  await expect(page).toHaveURL(WORK_HASH_PATTERN);
  await expect(page.locator("#work")).toBeVisible();
  const workViews = page.getByRole("navigation", { name: "Work views" });
  await expect(workViews).toBeVisible();
  await expect(
    workViews.getByRole("button", { name: "Board", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    workViews.getByRole("button", { name: "List", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved views" })).toHaveCount(0);
  const priorityMapLink = page.getByRole("link", {
    name: "Priority Map",
    exact: true,
  });
  await expect(priorityMapLink).toBeVisible();
  await priorityMapLink.click();
  await expect(page).toHaveURL(PRIORITY_MAP_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Priority Map", level: 3 }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await expect(page).toHaveURL(WORK_HASH_PATTERN);
  await expectDailyActions(page);
  await expect(
    page.getByRole("link", { name: "Create", exact: true }),
  ).toHaveAttribute("href", WORK_CREATE_HASH_PATTERN);
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(page.locator("#work-create")).toBeInViewport();
  await expect(page.getByRole("region", { name: "Create" })).toBeVisible();
  const nonGetRequestCountBeforeConfigurationMode = nonGetRequests.length;
  const customFieldsReadUrl = `${E2E_SERVER_URL}/rpc/customFields`;
  const configurationWrites = () =>
    nonGetRequests
      .slice(nonGetRequestCountBeforeConfigurationMode)
      .filter(
        (url) =>
          url !== customFieldsReadUrl && !url.includes("/rpc/workTemplates"),
      );

  await configurationMode.click();
  expect(configurationWrites()).toEqual([]);
  const exitConfigurationMode = page.getByRole("button", {
    name: "Exit Configuration Mode",
    exact: true,
  });
  await expect(exitConfigurationMode).toHaveAttribute("aria-pressed", "true");
  const configurationRegion = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await expect(page).toHaveURL(CONFIGURATION_MODE_URL_PATTERN);
  await expect(configurationRegion).toHaveAttribute("id", "configuration");
  await expect(configurationRegion).toBeVisible();
  await expect(configurationRegion).toBeInViewport();
  await expect(page.locator("#work")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Project navigation" }),
  ).toHaveCount(0);
  await Promise.all(
    [
      "Stages",
      "Work statuses",
      "Project areas",
      "Custom field",
      "Priority metrics",
      "Saved views",
      "Work Template",
      "Work Context Card layout",
    ].map((entry) =>
      expect(
        configurationRegion.getByRole("button", {
          name: entry,
          exact: true,
        }),
      ).toBeVisible(),
    ),
  );
  const projectConfigurationGroup = configurationRegion.getByRole("group", {
    name: "Project",
    exact: true,
  });
  const workConfigurationGroup = configurationRegion.getByRole("group", {
    name: "Work",
    exact: true,
  });
  await expect(projectConfigurationGroup).toBeVisible();
  await expect(workConfigurationGroup).toBeVisible();
  await expect(
    projectConfigurationGroup.getByRole("button", {
      name: "Project areas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    projectConfigurationGroup.getByRole("button", {
      name: "Stages",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    workConfigurationGroup.getByRole("button", {
      name: "Work statuses",
      exact: true,
    }),
  ).toBeVisible();

  const projectAreasHost = configurationRegion.locator(
    "#configuration-host-project-areas",
  );
  await expect(projectAreasHost).toBeVisible();
  await expect(
    projectAreasHost.getByText(
      "Enable, hide, and pin ready Project areas. These controls only change Project navigation; they do not create, move, or delete records.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    projectAreasHost.getByRole("list", { name: "Project areas" }),
  ).toBeVisible();
  await expect(
    projectAreasHost.getByRole("button", {
      name: "Enable Discovery",
      exact: true,
    }),
  ).toBeVisible();

  const workTemplateMutationPaths = [
    "/rpc/createWorkTemplate",
    "/rpc/instantiateWorkTemplate",
    "/rpc/updateWorkTemplate",
    "/rpc/trashWorkTemplate",
  ];
  const workTemplateWrites = () =>
    nonGetRequests
      .slice(nonGetRequestCountBeforeConfigurationMode)
      .filter((url) =>
        workTemplateMutationPaths.some((path) => url.includes(path)),
      );
  await configurationRegion
    .getByRole("button", { name: "Work Template", exact: true })
    .click();
  const workTemplateHost = configurationRegion.getByRole("region", {
    exact: true,
    name: "Work Template",
  });
  await expect(workTemplateHost).toBeVisible();
  await expect(
    workTemplateHost.getByRole("form", { name: "Add Work Template" }),
  ).toBeVisible();
  expect(workTemplateWrites()).toEqual([]);

  await configurationRegion
    .getByRole("button", { name: "Custom field", exact: true })
    .click();
  const customFieldHost = configurationRegion.getByRole("region", {
    exact: true,
    name: "Custom field",
  });
  await expect(customFieldHost).toBeVisible();
  await expect(
    customFieldHost.getByRole("heading", {
      name: "Custom field",
      level: 4,
    }),
  ).toBeVisible();
  await expect(
    customFieldHost.locator('[data-configuration-editor-host="custom-field"]'),
  ).toHaveCount(0);
  await expect(
    customFieldHost.getByRole("form", { name: "Add custom field" }),
  ).toBeVisible();
  await expect(customFieldHost.getByLabel("Type")).toBeVisible();
  await expect(
    customFieldHost.getByText("Lookup", { exact: true }),
  ).toHaveCount(0);
  await expect(
    customFieldHost.getByText("Formula", { exact: true }),
  ).toHaveCount(0);
  await configurationRegion
    .getByRole("button", { name: "Work Context Card layout", exact: true })
    .click();
  const layoutHost = configurationRegion.getByRole("region", {
    exact: true,
    name: "Work Context Card layout",
  });
  await expect(layoutHost).toBeVisible();
  await expect(
    layoutHost.getByRole("heading", {
      name: "Work Context Card layout",
      level: 4,
    }),
  ).toBeVisible();
  await expect(layoutHost.getByLabel("Work type")).toBeVisible();
  await expect(
    layoutHost.getByRole("list", { name: "Work Context Card sections" }),
  ).toBeVisible();
  await expect(
    layoutHost.getByRole("form", { name: "Add custom section" }),
  ).toBeVisible();
  await expect(
    layoutHost.getByRole("button", { name: "Preview" }),
  ).toBeVisible();
  await expect(
    layoutHost.getByRole("button", { name: "Confirm" }),
  ).toBeDisabled();

  expect(configurationWrites()).toEqual([]);
  await page.reload();
  await expect(configurationRegion).toBeVisible();
  await expect(page).toHaveURL(CONFIGURATION_MODE_URL_PATTERN);
  await exitConfigurationMode.click();
  await expect(page).toHaveURL(WORK_CREATE_HASH_PATTERN);
  await expect(configurationMode).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.locator('section[aria-label="Configuration Mode"]'),
  ).toHaveCount(0);
  await expectDailyActions(page);
  await expect(
    page.getByRole("heading", { name: projectName, level: 1 }),
  ).toBeVisible();
  await expect(
    page.locator("main > header").getByText("Active", { exact: true }),
  ).toBeVisible();
});

test("configures parallel stages, hidden areas, navigation pins, and protected status labels", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  const projectName = "Stages and Areas Acceptance";
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill(projectName);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await page.getByRole("link", { name: projectName, exact: true }).click();

  const configurationRegion = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  const projectNavigation = page.getByRole("navigation", {
    name: "Project navigation",
  });
  const projectAreas = configurationRegion
    .locator("#configuration-host-project-areas")
    .getByRole("list", { name: "Project areas" });
  async function enterConfigurationMode() {
    await page.getByRole("button", { name: "Configuration Mode" }).click();
    await expect(configurationRegion).toBeVisible();
  }
  async function exitConfigurationMode() {
    await page.getByRole("button", { name: "Exit Configuration Mode" }).click();
    await expect(configurationRegion).toHaveCount(0);
  }

  await enterConfigurationMode();
  await configurationRegion
    .getByRole("button", { name: "Stages", exact: true })
    .click();
  const stageEditor = configurationRegion.getByRole("list", {
    name: "Stages configuration",
  });
  await configurationRegion.locator("#new-project-stage").fill("Research");
  await configurationRegion.getByRole("button", { name: "Add stage" }).click();
  await expect(
    stageEditor.getByRole("textbox", { name: "Stage name Research" }),
  ).toBeVisible();
  await stageEditor
    .getByRole("combobox", { name: "Research status" })
    .selectOption("Active");

  await configurationRegion.locator("#new-project-stage").fill("Build");
  await configurationRegion.getByRole("button", { name: "Add stage" }).click();
  await stageEditor
    .getByRole("combobox", { name: "Build status" })
    .selectOption("Active");
  await expect(
    stageEditor.getByRole("combobox", { name: "Research status" }),
  ).toHaveValue("Active");
  await expect(
    stageEditor.getByRole("combobox", { name: "Build status" }),
  ).toHaveValue("Active");

  await stageEditor
    .getByRole("textbox", { name: "Stage name Research" })
    .fill("Discovery research");
  await stageEditor.getByRole("button", { name: "Save" }).first().click();
  await expect(
    stageEditor.getByRole("textbox", { name: "Stage name Discovery research" }),
  ).toBeVisible();
  const removeStageButtons = stageEditor.getByRole("button", {
    name: "Remove stage",
    exact: true,
  });
  await removeStageButtons.last().click();
  await expect(
    stageEditor.getByText(
      "Build will leave presentation and filters. Main records are not deleted.",
      { exact: true },
    ),
  ).toBeVisible();
  await removeStageButtons.last().click();
  await expect(
    stageEditor.getByRole("textbox", { name: "Stage name Build" }),
  ).toHaveCount(0);

  await configurationRegion
    .getByRole("button", { name: "Project areas", exact: true })
    .click();
  await expect(projectAreas).toBeVisible();
  const allTools = page.getByRole("list", { name: "All Project areas" });
  await expect(
    projectAreas
      .getByRole("listitem", { name: "Work Enabled", exact: true })
      .getByRole("button", { name: "Pin to navigation", exact: true }),
  ).toHaveCount(0);
  await expect(
    projectAreas
      .getByRole("listitem", { name: "Documents Enabled", exact: true })
      .getByRole("button", { name: "Pin to navigation", exact: true }),
  ).toHaveCount(0);
  await projectAreas
    .getByRole("button", { name: "Enable Discovery", exact: true })
    .click();
  await expect(
    projectAreas.getByRole("listitem", {
      name: "Discovery Enabled",
      exact: true,
    }),
  ).toBeVisible();
  await exitConfigurationMode();
  await projectNavigation.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.locator(
      '[data-project-overview="true"] [data-overview-area-entry="Discovery"]',
    ),
  ).toBeVisible();
  await projectNavigation.getByRole("link", { name: "All Tools" }).click();
  await expect(allTools.getByRole("listitem")).toHaveCount(
    ALL_PROJECT_AREAS.length,
  );

  await enterConfigurationMode();
  await projectAreas
    .getByRole("button", { name: "Hide Discovery", exact: true })
    .click();
  await expect(
    projectAreas.getByRole("listitem", {
      name: "Discovery Hidden",
      exact: true,
    }),
  ).toBeVisible();
  await exitConfigurationMode();
  await projectNavigation.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.locator(
      '[data-project-overview="true"] [data-overview-area-entry="Discovery"]',
    ),
  ).toHaveCount(0);
  await enterConfigurationMode();
  await projectAreas
    .getByRole("button", { name: "Show Discovery", exact: true })
    .click();
  await expect(
    projectAreas.getByRole("listitem", {
      name: "Discovery Enabled",
      exact: true,
    }),
  ).toBeVisible();
  await exitConfigurationMode();
  await projectNavigation.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.locator(
      '[data-project-overview="true"] [data-overview-area-entry="Discovery"]',
    ),
  ).toBeVisible();
  await enterConfigurationMode();
  await projectAreas
    .getByRole("listitem", { name: "Discovery Enabled", exact: true })
    .getByRole("button", { name: "Pin to navigation", exact: true })
    .click();
  await exitConfigurationMode();
  await expect(
    projectNavigation.getByRole("link", { name: "Discovery", exact: true }),
  ).toBeVisible();

  await enterConfigurationMode();
  await configurationRegion
    .getByRole("button", { name: "Restore default navigation", exact: true })
    .click();
  const navigationPreview = configurationRegion.getByRole("group", {
    name: "Navigation preview",
  });
  await expect(navigationPreview).toBeVisible();
  await expect(
    navigationPreview.getByText("Current pinned areas: Discovery", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    navigationPreview.getByText("Default pinned areas: None", { exact: true }),
  ).toBeVisible();
  await navigationPreview
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(navigationPreview).toHaveCount(0);

  await configurationRegion
    .getByRole("button", { name: "Restore default navigation", exact: true })
    .click();
  const confirmedNavigationPreview = configurationRegion.getByRole("group", {
    name: "Navigation preview",
  });
  const restoreResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await confirmedNavigationPreview
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await restoreResponse;
  await exitConfigurationMode();
  await expect(
    projectNavigation.getByRole("link", { name: "Discovery", exact: true }),
  ).toHaveCount(0);

  await enterConfigurationMode();
  await configurationRegion
    .getByRole("button", { name: "Work statuses", exact: true })
    .click();
  await expect(
    configurationRegion.getByRole("button", {
      name: "Restore default navigation",
      exact: true,
    }),
  ).toHaveCount(0);
  const statusEditor = configurationRegion.getByRole("list", {
    name: "Work status configuration",
  });
  await statusEditor
    .getByRole("textbox", { name: "Work status label Closed" })
    .fill("Done");
  const statusUpdateResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await statusEditor
    .getByRole("listitem")
    .filter({ hasText: "Closed" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await statusUpdateResponse;
  await expect(
    statusEditor.getByRole("textbox", { name: "Work status label Closed" }),
  ).toHaveValue("Done");

  const inProgressStatus = statusEditor
    .getByRole("listitem")
    .filter({ hasText: "In Progress" });
  await inProgressStatus
    .getByRole("spinbutton", { name: "Soft WIP In Progress" })
    .fill("3");
  const softWipResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await inProgressStatus.getByRole("button", { name: "Save Soft WIP" }).click();
  await softWipResponse;

  await configurationRegion
    .getByRole("button", { name: "Saved views", exact: true })
    .click();
  const sortUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await configurationRegion.getByLabel("Sort by").selectOption("title");
  await sortUpdate;
  const directionUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await configurationRegion
    .getByLabel("Sort direction")
    .selectOption("descending");
  await directionUpdate;
  await configurationRegion
    .getByRole("spinbutton", { name: "Focus threshold" })
    .fill("2");
  const focusThresholdResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rpc/updateProjectConfiguration") &&
      response.ok(),
  );
  await configurationRegion
    .getByRole("button", { name: "Save Focus threshold" })
    .click();
  await focusThresholdResponse;

  await page.reload();
  await expect(configurationRegion).toBeVisible();
  await configurationRegion
    .getByRole("button", { name: "Saved views", exact: true })
    .click();
  await expect(configurationRegion.getByLabel("Sort by")).toHaveValue("title");
  await expect(configurationRegion.getByLabel("Sort direction")).toHaveValue(
    "descending",
  );
  await expect(
    configurationRegion.getByRole("spinbutton", { name: "Focus threshold" }),
  ).toHaveValue("2");
  await configurationRegion
    .getByRole("button", { name: "Work statuses", exact: true })
    .click();
  await expect(
    configurationRegion
      .getByRole("list", { name: "Work status configuration" })
      .getByRole("textbox", { name: "Work status label Closed" }),
  ).toHaveValue("Done");
  await expect(
    configurationRegion
      .getByRole("list", { name: "Work status configuration" })
      .getByRole("spinbutton", { name: "Soft WIP In Progress" }),
  ).toHaveValue("3");
  await configurationRegion
    .getByRole("button", { name: "Stages", exact: true })
    .click();
  await expect(
    configurationRegion.getByRole("textbox", {
      name: "Stage name Discovery research",
    }),
  ).toBeVisible();
  await expect(
    configurationRegion
      .getByRole("list", { name: "Stages configuration" })
      .getByRole("textbox", { name: "Stage name Build" }),
  ).toHaveCount(0);

  await page.setViewportSize({ height: 844, width: 375 });
  const projectConfigurationGroup = configurationRegion.getByRole("group", {
    name: "Project",
    exact: true,
  });
  const projectAreasHost = configurationRegion.locator(
    "#configuration-host-project-areas",
  );
  const mobileConfigurationSelector = configurationRegion.getByRole(
    "combobox",
    { exact: true, name: "Configuration Mode" },
  );
  await expect(mobileConfigurationSelector).toBeVisible();
  await expect(projectConfigurationGroup).toBeHidden();
  await mobileConfigurationSelector.selectOption("Project areas");
  await expect(projectAreasHost).toBeVisible();
  await expect(
    projectAreasHost.getByRole("list", { name: "Project areas" }),
  ).toBeVisible();
  await mobileConfigurationSelector.selectOption("Work statuses");
  await expect(projectAreasHost).toHaveCount(0);
  await expect(
    configurationRegion.getByRole("list", {
      name: "Work status configuration",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const starter of STARTER_CONFIGURATION_CASES) {
  test(`applies ${starter.configuration} once at the Project Shell`, async ({
    context,
    page,
    request,
  }) => {
    const setupResponse = await request.get(
      `${E2E_SERVER_URL}/__e2e/setup?fixture=project-shell-starter-matrix`,
    );
    expect(setupResponse.ok()).toBe(true);
    const setup = (await setupResponse.json()) as {
      cookie: Parameters<typeof context.addCookies>[0][number];
    };
    await context.addCookies([setup.cookie]);

    const projectName = `${starter.configuration} Acceptance`;
    await page.goto("/projects/new");
    await page.getByLabel("Project Name").fill(projectName);
    await page
      .getByLabel("Starter Configuration")
      .selectOption(starter.configuration);
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
    await page.getByRole("link", { name: projectName, exact: true }).click();
    await expect(page).toHaveURL(PROJECT_DETAIL_URL_PATTERN);
    await expect(
      page.getByRole("heading", { name: projectName, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(starter.configuration, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "location");

    const projectOverview = page.locator('[data-project-overview="true"]');
    await expect(
      projectOverview.getByRole("heading", { name: "Overview", level: 2 }),
    ).toBeVisible();
    await Promise.all(
      [
        "Purpose",
        "Lifecycle",
        "Goals",
        "Stages",
        "Milestones",
        "Work",
        "Documents",
        "Decisions",
        "Risks",
        "Tests",
        "Production",
        "Blockers",
        "Dates",
        "Recent changes",
      ].map((moduleName) =>
        expect(
          projectOverview.locator(`[data-overview-module="${moduleName}"]`),
        ).toBeVisible(),
      ),
    );
    await expect(
      projectOverview
        .getByText("No source records yet.", { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      projectOverview.locator('[data-overview-area="Goals"]'),
    ).toHaveCount(0);

    await Promise.all(
      ["Overview", "Work", "Documents", "All Tools"].map((surface) =>
        expect(
          page
            .getByRole("navigation", { name: "Project navigation" })
            .getByRole("link", { name: surface, exact: true }),
        ).toBeVisible(),
      ),
    );
    await Promise.all(
      starter.extraPinnedAreas.map((area) =>
        expect(
          page
            .getByRole("navigation", { name: "Project navigation" })
            .getByRole("link", { name: area, exact: true }),
        ).toBeVisible(),
      ),
    );
    await expect(
      page.getByLabel("Starter Configuration", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("list", { name: "Enabled Project areas" })
        .getByRole("listitem"),
    ).toHaveText(starter.areas);
    await expect(
      page.getByRole("list", { name: "Stages" }).getByRole("listitem"),
    ).toHaveText(starter.stages);
    await expect(
      page.getByRole("list", { name: "Saved views" }).getByRole("listitem"),
    ).toHaveText(starter.views);
    await expect(
      page.getByRole("list", { name: "Work statuses" }).getByRole("listitem"),
    ).toHaveText(["Not Started", "In Progress", "Blocked", "Closed"]);
    await expectNoSampleContent(page);
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expectNoSampleContent(page);
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);

    await page.getByRole("button", { name: "Configuration Mode" }).click();
    const configurationRegion = page.locator(
      'section[aria-label="Configuration Mode"]',
    );
    const projectAreas = configurationRegion
      .locator("#configuration-host-project-areas")
      .getByRole("list", { name: "Project areas" });
    await expect(projectAreas.getByRole("listitem")).toHaveCount(
      ALL_PROJECT_AREAS.length,
    );
    const enabledAreas = new Set<string>(starter.areas);
    await Promise.all(
      ALL_PROJECT_AREAS.map((area) =>
        expect(
          projectAreas.getByRole("listitem", {
            name: `${area} ${enabledAreas.has(area) ? "Enabled" : "Available"}`,
            exact: true,
          }),
        ).toBeVisible(),
      ),
    );
    if (!starter.areas.some((area) => area === "Discovery")) {
      await projectAreas
        .getByRole("button", { name: "Enable Discovery", exact: true })
        .click();
      await expect(
        projectAreas.getByRole("listitem", {
          name: "Discovery Enabled",
          exact: true,
        }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Exit Configuration Mode" }).click();
    await page
      .getByRole("navigation", { name: "Project navigation" })
      .getByRole("link", { name: "All Tools", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "All Tools", level: 2 }),
    ).toBeVisible();
    const allTools = page.getByRole("list", { name: "All Project areas" });
    await expect(allTools.getByRole("listitem")).toHaveCount(
      ALL_PROJECT_AREAS.length,
    );
    await Promise.all(
      ALL_PROJECT_AREAS.map((area) =>
        expect(
          allTools.getByRole("listitem", {
            name: `${area} ${enabledAreas.has(area) || area === "Discovery" ? "Enabled" : "Available"}`,
            exact: true,
          }),
        ).toBeVisible(),
      ),
    );

    await page
      .getByRole("navigation", { name: "Project navigation" })
      .getByRole("link", { name: "Work", exact: true })
      .click();
    await expect(page).toHaveURL(WORK_HASH_PATTERN);
    await expect(page.locator("#work")).toBeInViewport();
    await expect(
      page
        .getByRole("navigation", { name: "Project navigation" })
        .getByRole("link", { name: "Work", exact: true }),
    ).toHaveAttribute("aria-current", "location");

    await page
      .getByRole("navigation", { name: "Project navigation" })
      .getByRole("link", { name: "Documents", exact: true })
      .click();
    await expect(page).toHaveURL(DOCUMENTS_HASH_PATTERN);
    await expect(page.locator("#documents")).toBeInViewport();
    await expect(
      page.getByRole("heading", { name: "File Attachments", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("No File Attachments are available in this Project yet.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Project navigation" })
        .getByRole("link", { name: "Documents", exact: true }),
    ).toHaveAttribute("aria-current", "location");

    const [pinnedArea] = starter.extraPinnedAreas;
    if (pinnedArea) {
      await page
        .getByRole("navigation", { name: "Project navigation" })
        .getByRole("link", { name: pinnedArea, exact: true })
        .click();
      const pinnedAreaAnchor = `#project-area-${pinnedArea.toLowerCase().replaceAll(" ", "-")}`;
      await expect(page).toHaveURL(new RegExp(`${pinnedAreaAnchor}$`));
      await expect(page.locator(pinnedAreaAnchor)).toBeInViewport();
      await expect(
        page
          .getByRole("navigation", { name: "Project navigation" })
          .getByRole("link", { name: pinnedArea, exact: true }),
      ).toHaveAttribute("aria-current", "location");
    }
  });
}
