import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("Personal Wiki reuses Documents without entering a Project and exposes no publishing surface", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=personal-wiki`,
  );
  expect(response.ok()).toBe(true);
  const setup = (await response.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);
  await page.goto("/projects");
  await page.getByRole("link", { name: "Personal Wiki", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Personal Wiki", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create Document" });
  await expect(dialog.getByLabel("Project", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByLabel("Starter skeleton", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("PostgreSQL troubleshooting");
  await dialog
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("# Recovering a connection\n\nRetry after reconnecting.");
  const savedResponse = page.waitForResponse((saveResponse) =>
    saveResponse.url().endsWith("/rpc/updateDocument"),
  );
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  expect((await savedResponse).ok()).toBe(true);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents", exact: true })
    .getByRole("button", { name: "PostgreSQL troubleshooting", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toHaveValue("# Recovering a connection\n\nRetry after reconnecting.");
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .press("Home");
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .press("Shift+End");
  await expect(
    editor.getByRole("button", {
      name: "Version-pinned evidence",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    editor.getByRole("button", { name: "Convert to record", exact: true }),
  ).toBeDisabled();
  const documentHash = await page
    .getByRole("navigation", { name: "Documents", exact: true })
    .getByRole("button", { name: "PostgreSQL troubleshooting", exact: true })
    .getAttribute("id");
  await page.goto(`/personal-wiki#${documentHash}`);
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "PostgreSQL troubleshooting",
  );
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Create Document" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Create Document" }),
  ).toHaveCount(0);
});
