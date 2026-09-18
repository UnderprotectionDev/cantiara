import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("keeps Sequential triage focused until a confirmed exit", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=capture-inbox`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/capture");
  await expect(
    page.getByRole("heading", { name: "Capture Inbox", level: 1 }),
  ).toBeVisible();

  async function saveCapture(content: string) {
    await page.getByLabel("Capture", { exact: true }).fill(content);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(content, { exact: true })).toBeVisible();
  }

  await saveCapture("Convert this capture");
  await saveCapture("Attach this capture");
  await saveCapture("Delete this capture");

  await page
    .getByRole("button", { name: "Sequential triage", exact: true })
    .click();
  const sequentialItem = page.getByRole("article", {
    name: "Sequential triage item",
  });
  await expect(sequentialItem).toContainText("Delete this capture");
  await expect(
    page.getByRole("button", { name: "Next item", exact: true }),
  ).toHaveCount(0);

  await sequentialItem
    .getByRole("button", { name: "Convert", exact: true })
    .click();
  await expect(
    sequentialItem.getByRole("heading", {
      name: "Choose conversion target",
      level: 3,
    }),
  ).toBeVisible();
  await sequentialItem
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Delete this capture");

  await sequentialItem
    .getByRole("button", { name: "Show suggestions", exact: true })
    .click();
  const suggestions = page.getByRole("region", { name: "Suggestions" });
  await expect(suggestions).toBeVisible();
  await suggestions
    .getByRole("button", { name: "Close suggestions", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Delete this capture");
  await expect(
    page.getByRole("button", { name: "Next item", exact: true }),
  ).toHaveCount(0);

  await sequentialItem
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Attach this capture");
  await expect(
    page.getByRole("button", { name: "Next item", exact: true }),
  ).toHaveCount(0);

  await sequentialItem
    .getByRole("button", { name: "Attach to existing", exact: true })
    .click();
  await sequentialItem.getByLabel("Target record ID").fill("target-1");
  await sequentialItem
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(
    sequentialItem.getByRole("heading", { name: "Attach Preview", level: 3 }),
  ).toBeVisible();
  await sequentialItem
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Convert this capture");
  await expect(
    page.getByRole("dialog", { name: "Undo Preview" }),
  ).toBeVisible();
  const undoPreview = page.getByRole("dialog", { name: "Undo Preview" });
  await undoPreview
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Convert this capture");
  await sequentialItem
    .getByRole("button", { name: "Previous item", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Attach this capture");
  await expect(
    sequentialItem.getByRole("button", {
      name: "Attach to existing",
      exact: true,
    }),
  ).toBeVisible();

  await sequentialItem
    .getByRole("button", { name: "Attach to existing", exact: true })
    .click();
  await sequentialItem.getByLabel("Target record ID").fill("target-1");
  await sequentialItem
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await sequentialItem
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(sequentialItem).toContainText("Convert this capture");
  await expect(
    page.getByRole("dialog", { name: "Undo Preview" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Undo Preview" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();

  await sequentialItem
    .getByRole("button", { name: "Convert", exact: true })
    .click();
  await sequentialItem.getByLabel("Conversion target").selectOption("Work");
  await sequentialItem
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(
    sequentialItem.getByRole("heading", {
      name: "Conversion Preview",
      level: 3,
    }),
  ).toBeVisible();
  await sequentialItem
    .getByRole("button", { name: "Confirm", exact: true })
    .click();

  await expect(
    page.getByText(
      "Sequential triage is complete. No captures are waiting in this session.",
      { exact: true },
    ),
  ).toBeVisible();
});
