import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const PROJECTS_URL_PATTERN = /\/projects$/;

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
