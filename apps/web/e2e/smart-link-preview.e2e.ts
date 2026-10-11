import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test } from "@playwright/test";

test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Sources and Freshness keeps previews transient, explicitly saves a snapshot and denies private redirects", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const preview = page.getByRole("region", {
    name: "Smart link preview",
    exact: true,
  });
  await preview.getByLabel("Source URL").fill("https://example.org/research");
  await preview.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview).toContainText("Founder research");
  await expect(page.locator("#sources article")).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Save as Source", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(preview).toContainText("Source saved.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#sources article")).toContainText(
    "Original research finding.",
  );
  await expect(page.locator("#sources article")).toContainText(
    "Historical snapshot",
  );
  await preview
    .getByLabel("Source URL")
    .fill("https://example.org/redirect-private");
  await preview.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview.getByRole("alert")).toContainText(
    "Preview unavailable.",
  );
  await expect(preview.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.org/redirect-private",
  );
  await expect(
    preview.getByRole("button", { name: "Save as Source", exact: true }),
  ).toHaveCount(0);
  await preview.getByLabel("Source URL").fill("https://youtu.be/dQw4w9WgXcQ");
  await preview.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview).toContainText("Live external source");
  await expect(preview.locator("iframe")).toHaveCount(0);
  await expect(
    page.locator('script[src="https://www.youtube.com/iframe_api"]'),
  ).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Load YouTube", exact: true }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page }).include("#sources").analyze();
  expect(audit.violations).toEqual([]);
  await preview
    .getByText("Live external source", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../../.context/smart-link-preview.png" });
  await preview.getByLabel("Source URL").fill("https://vimeo.com/12345");
  await preview.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview).toContainText("Founder research");
  await expect(
    preview.getByRole("button", { name: "Load YouTube", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#sources article")).toHaveCount(1);
});
