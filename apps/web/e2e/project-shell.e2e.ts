import { expect, type Page, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;
const PROJECT_DETAIL_URL_PATTERN = /\/projects\/[^/]+$/;
const WORK_HASH_PATTERN = /#work$/;
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

const STARTER_CONFIGURATION_CASES = [
  {
    configuration: "Blank Project",
    areas: ["Work", "Documents"],
    extraPinnedAreas: [],
    stages: [],
    views: ["Backlog", "Board"],
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
    views: ["Backlog", "Board", "Roadmap"],
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
    views: ["Backlog", "Board", "Roadmap"],
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
    views: ["Backlog", "Board", "Roadmap"],
  },
] as const;

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

  await page.getByLabel("Project Name").fill("Payment App");
  await expect(page.getByLabel("Short code")).toHaveValue("PAY");
  await page.getByRole("button", { name: "Create Project" }).click();

  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  await expect(page.getByText("Project Shell", { exact: true })).toHaveCount(0);
  const firstProject = page
    .getByRole("listitem")
    .filter({ hasText: "Payment App" });
  await expect(firstProject).toContainText("Active");
  await expect(firstProject).toContainText("Blank Project");
  const firstShortCode = firstProject.getByRole("textbox", {
    name: "Short code",
  });
  await expect(firstShortCode).toHaveValue("PAY");

  await firstShortCode.fill("PAYS");
  await firstProject.getByRole("button", { name: "Save Short code" }).click();
  await expect(firstShortCode).toHaveValue("PAYS");

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
  await expect(page.getByLabel("Short code")).toHaveValue("PAY");
  await page.getByRole("button", { name: "Create Project" }).click();

  await expect(page).toHaveURL(PROJECTS_URL_PATTERN);
  const secondProject = page
    .getByRole("listitem")
    .filter({ hasText: "Payment Reports" });
  await expect(
    secondProject.getByRole("textbox", { name: "Short code" }),
  ).toHaveValue("PAY-2");
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

    await Promise.all(
      ["Overview", "Work", "Documents", "All Tools"].map((surface) =>
        expect(
          page.getByRole("link", { name: surface, exact: true }),
        ).toBeVisible(),
      ),
    );
    await Promise.all(
      starter.extraPinnedAreas.map((area) =>
        expect(
          page.getByRole("link", { name: area, exact: true }),
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

    await page.getByRole("link", { name: "All Tools", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "All Tools", exact: true }),
    ).toHaveAttribute("aria-current", "location");
    await expect(
      page.getByRole("heading", { name: "All Tools", level: 2 }),
    ).toBeVisible();
    const allTools = page.getByRole("list", { name: "All Project areas" });
    await expect(allTools.getByRole("listitem")).toHaveCount(
      ALL_PROJECT_AREAS.length,
    );
    await Promise.all(
      ALL_PROJECT_AREAS.map((area) =>
        expect(allTools.getByText(area, { exact: true })).toBeVisible(),
      ),
    );
    if (!starter.areas.some((area) => area === "Discovery")) {
      await allTools
        .getByRole("button", { name: "Enable Discovery", exact: true })
        .click();
      await expect(
        allTools.getByRole("listitem", {
          name: "Discovery Enabled",
          exact: true,
        }),
      ).toBeVisible();
    }

    await page.getByRole("link", { name: "Work", exact: true }).click();
    await expect(page).toHaveURL(WORK_HASH_PATTERN);
    await expect(page.locator("#work")).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Work", exact: true }),
    ).toHaveAttribute("aria-current", "location");

    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(DOCUMENTS_HASH_PATTERN);
    await expect(page.locator("#documents")).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Documents", exact: true }),
    ).toHaveAttribute("aria-current", "location");

    const [pinnedArea] = starter.extraPinnedAreas;
    if (pinnedArea) {
      await page.getByRole("link", { name: pinnedArea, exact: true }).click();
      const pinnedAreaAnchor = `#project-area-${pinnedArea.toLowerCase().replaceAll(" ", "-")}`;
      await expect(page).toHaveURL(new RegExp(`${pinnedAreaAnchor}$`));
      await expect(page.locator(pinnedAreaAnchor)).toBeInViewport();
      await expect(
        page.getByRole("link", { name: pinnedArea, exact: true }),
      ).toHaveAttribute("aria-current", "location");
    }
  });
}
