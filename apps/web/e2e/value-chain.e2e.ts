import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const WRITE_RPC =
  /\/rpc\/(create|update|set|add|remove|delete|archive|trash|close|save|move|apply|link|attach|restore|accept)/;
const WORK_AREA_URL = /#(project-area-)?work/;
const FORBIDDEN_OUTPUT = /\bhealth\b|\bscore\b|on track|\d+%/i;

test("Value Chain shows a Goal's gaps, writes nothing from a gap action, and has no health", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=value-chain`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Value Chain Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Value Chain Acceptance", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open source record: Goals", exact: true })
    .click();
  await page.getByRole("button", { name: "New Project Goal" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Reach founders");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Help founders keep context.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Project Goal saved.")).toBeVisible();
  await page.getByRole("link", { name: "Reach founders", exact: true }).click();

  const chain = page.getByRole("region", { name: "Value Chain" });
  await expect(chain).toBeVisible();
  await expect(chain).toContainText(
    "No Work, Milestone or Project Release contributes to this goal.",
  );
  await expect(
    chain.getByRole("heading", { name: "Not linked to goal (0)" }),
  ).toBeVisible();
  await expect(chain).not.toContainText(FORBIDDEN_OUTPUT);

  const writes: string[] = [];
  page.on("request", (req) => {
    if (WRITE_RPC.test(req.url())) {
      writes.push(req.url());
    }
  });
  const fill = chain.getByRole("button", { name: "Fill this gap" });
  await fill.focus();
  await page.keyboard.press("Enter");
  await expect(fill).toHaveAttribute("aria-expanded", "true");
  await expect(chain).toContainText(
    "Nothing is written until you save the relation in the owning feature. No other record changes status.",
  );
  await expect(
    chain.getByRole("link", { name: "Choose an existing record" }),
  ).toBeVisible();
  await chain.getByRole("link", { name: "Start a new record" }).click();
  await expect(page).toHaveURL(WORK_AREA_URL);
  expect(writes).toEqual([]);

  await page.goBack();
  await expect(page.getByRole("region", { name: "Value Chain" })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby^="value-chain-"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});
