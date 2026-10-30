// biome-ignore-all lint/performance/useTopLevelRegex: Playwright locators use local regex patterns for visible copy.
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const FORMULA_TITLE = "=1+1 Portability";
const SECRET_WORDS = /token|password|secret/i;

async function createWork(page: Page, title: string) {
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Title").fill(title);
  await page
    .locator("#work-create")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(
    page.locator("#work-create").getByText(/Work .* created\./),
  ).toBeVisible({ timeout: 20_000 });
}

async function downloadedText(page: Page) {
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, "utf8") };
}

// Taşınabilirlik journey for the Selected Export seam (spec 79), through the UI.
test("Export previews before download, keeps JSON raw and CSV spreadsheet-safe, omits secrets, refuses unlisted families and completes by keyboard", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Portability Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Portability Acceptance", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await createWork(page, FORMULA_TITLE);

  await page.goto("/export");
  const form = page.getByRole("form", { name: "Export selection" });
  await expect(form).toBeVisible();

  // The closed catalog: no Document, no other format.
  const recordType = form.getByLabel("Record type");
  await expect(recordType.locator("option", { hasText: "Task" })).toHaveCount(
    1,
  );
  await expect(form).not.toContainText("Document");
  await expect(page.getByText("Markdown")).toHaveCount(0);
  await expect(page.getByText("XLS")).toHaveCount(0);

  // Keyboard only: type-ahead picks Task, Tab reaches Format, Enter previews.
  await recordType.focus();
  await page.keyboard.type("Task");
  await expect(recordType).toHaveValue("Task");
  await form.getByRole("radio", { name: "JSON" }).focus();
  await page.keyboard.press("Space");
  await form.getByRole("button", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("Enter");

  // JSON preview comes first and nothing is downloadable yet.
  const heading = page.getByRole("heading", { name: "Export Task as JSON" });
  await expect(heading).toBeFocused();
  const panel = page.getByRole("region", { name: "Export Task as JSON" });
  await expect(panel).toContainText("never included");
  await expect(panel).toContainText("EU region");
  await expect(panel).toContainText("not a live link");
  await expect(page.getByRole("link", { name: /^Download/ })).toHaveCount(0);

  // Escape cancels the review without producing anything.
  await page.keyboard.press("Escape");
  await expect(heading).toBeHidden();
  await form.getByRole("button", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();

  // Confirm with the keyboard, then download the JSON.
  await panel.getByRole("button", { name: "Export", exact: true }).focus();
  await page.keyboard.press("Enter");
  const jsonLink = page.getByRole("link", { name: /^Download .*\.json$/ });
  await expect(jsonLink).toBeVisible();
  await jsonLink.focus();
  const json = await downloadedText(page);
  expect(json.name).toMatch(/\.json$/);
  const parsed = JSON.parse(json.text);
  expect(parsed.schemaVersion).toBe("cantiara-export/1");
  expect(parsed.manifest.format).toBe("JSON");
  // JSON keeps the raw value: no spreadsheet escape.
  const jsonTitles = (
    parsed.records as Array<{ values: { title: string } }>
  ).map((record) => record.values.title);
  expect(jsonTitles).toContain(FORMULA_TITLE);
  expect(json.text).not.toMatch(SECRET_WORDS);

  // CSV: preview reports the escape and the loss, the bytes escape the cell.
  await form.getByRole("radio", { name: "CSV" }).focus();
  await page.keyboard.press("Space");
  await form.getByRole("button", { name: "Preview", exact: true }).focus();
  await page.keyboard.press("Enter");
  const csvPanel = page.getByRole("region", { name: "Export Task as CSV" });
  await expect(csvPanel).toContainText("Spreadsheet safety");
  await expect(csvPanel).toContainText("Lost in this format");
  await csvPanel.getByRole("button", { name: "Export", exact: true }).focus();
  await page.keyboard.press("Enter");
  const csvLink = page.getByRole("link", { name: /^Download .*\.csv$/ });
  await expect(csvLink).toBeVisible();
  await csvLink.focus();
  const csv = await downloadedText(page);
  expect(csv.text).toContain(`'${FORMULA_TITLE}`);
  expect(csv.text).not.toMatch(SECRET_WORDS);

  // An unlisted family is refused with a stable code and writes nothing.
  // The request carries the session cookie and the web origin by hand: the
  // server host is not the cookie's origin, and cookie writes need an Origin.
  const refused = await context.request.post(`${serverUrl}/rpc/exportPreview`, {
    headers: {
      Cookie: `${setup.cookie.name}=${setup.cookie.value}`,
      Origin: `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? "4173"}`,
    },
    data: {
      json: {
        filters: {},
        format: "JSON",
        recordType: "Document",
        scope: { kind: "workspace" },
      },
    },
  });
  expect(refused.ok()).toBe(false);
  expect(await refused.text()).toContain("unlisted_family");
});
