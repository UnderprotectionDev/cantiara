import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("previews Project transfers, copies independently and moves only selected Documents into Personal Wiki", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  const projectRoute = `/projects/${setup.projectId}#documents`;
  await page.goto(projectRoute);
  const surface = page.getByRole("region", { name: "Documents", exact: true });
  const editor = page.getByRole("region", { name: "Document", exact: true });
  const navigation = page.getByRole("navigation", {
    name: "Documents",
    exact: true,
  });
  async function createDocument(title: string) {
    await surface
      .getByRole("button", { name: "Create Document", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Create Document",
      exact: true,
    });
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog
      .getByRole("button", { name: "Create Document", exact: true })
      .click();
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
      title,
    );
  }
  await createDocument("Reusable knowledge");
  const rootButton = navigation.getByRole("button", {
    name: "Reusable knowledge",
    exact: true,
  });
  const rootHash = await rootButton.getAttribute("id");
  expect(rootHash).toBeTruthy();
  await createDocument("Project-only child");
  await editor
    .getByRole("button", { name: "Organize Document", exact: true })
    .click();
  const organize = page.getByRole("dialog", {
    name: "Organize Document",
    exact: true,
  });
  await organize
    .getByLabel("Parent Document", { exact: true })
    .selectOption({ label: "Reusable knowledge" });
  await organize.getByRole("button", { name: "Preview", exact: true }).click();
  await organize.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(organize).toBeHidden();
  await rootButton.click();
  await editor.getByRole("button", { name: "Move", exact: true }).click();
  const move = page.getByRole("dialog", { name: "Move", exact: true });
  await expect(
    move.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await move.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(move).toContainText("Project-only child");
  await move.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(rootButton).toBeVisible();
  await editor.getByRole("button", { name: "Copy", exact: true }).click();
  const copy = page.getByRole("dialog", { name: "Copy", exact: true });
  await copy.getByRole("button", { name: "Preview", exact: true }).click();
  async function loseFirstTransferResponse() {
    const commands: string[] = [];
    await page.route("**/rpc/transferDocument", async (route) => {
      commands.push(route.request().postData() ?? "");
      const committedResponse = await route.fetch();
      expect(committedResponse.ok()).toBe(true);
      if (commands.length === 1) {
        await route.abort("failed");
      } else {
        await route.fulfill({ response: committedResponse });
      }
    });
    return commands;
  }
  const confirmedCommands = await loseFirstTransferResponse();
  await copy.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(copy.getByRole("alert")).toBeVisible();
  await expect(
    copy.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  await copy.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(copy).toBeHidden();
  expect(confirmedCommands).toHaveLength(2);
  expect(confirmedCommands[1]).toBe(confirmedCommands[0]);
  await page.unroute("**/rpc/transferDocument");
  await page.goto("/personal-wiki");
  const copiedButton = navigation.getByRole("button", {
    name: "Reusable knowledge",
    exact: true,
  });
  await expect(copiedButton).toHaveCount(1);
  await copiedButton.click();
  const copyHash = await copiedButton.getAttribute("id");
  expect(copyHash).not.toBe(rootHash);
  await expect(editor).toContainText("Copy origin");
  await editor
    .getByRole("link", { name: "Open source record", exact: true })
    .click();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Reusable knowledge",
  );
  await expect(page).toHaveURL(
    new RegExp(`/projects/${setup.projectId}#${rootHash}$`),
  );
  await page.goto(`/personal-wiki#${copyHash}`);
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("Independent Wiki content");
  const saved = page.waitForResponse((result) =>
    result.url().endsWith("/rpc/updateDocument"),
  );
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toHaveValue("Independent Wiki content");
  await page.goto(`/projects/${setup.projectId}#${rootHash}`);
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).not.toHaveValue("Independent Wiki content");
  await editor.getByRole("button", { name: "Move", exact: true }).click();
  await move.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    move.getByRole("checkbox", { name: "Project-only child", exact: true }),
  ).not.toBeChecked();
  const moveCommands = await loseFirstTransferResponse();
  await move.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(move.getByRole("alert")).toBeVisible();
  await expect(
    move.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  await move.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(move).toBeHidden();
  expect(moveCommands).toHaveLength(2);
  expect(moveCommands[1]).toBe(moveCommands[0]);
  await page.unroute("**/rpc/transferDocument");
  await expect(rootButton).toHaveCount(0);
  await navigation
    .getByRole("button", { name: "Project-only child", exact: true })
    .click();
  await expect(editor).not.toContainText("Parent Document: Reusable knowledge");
  await page.goto(`/personal-wiki#${rootHash}`);
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Reusable knowledge",
  );
  await page.reload();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Reusable knowledge",
  );
  await expect(page.locator(`[id="${rootHash}"]`)).toBeVisible();
  await expect(
    navigation.getByRole("button", { name: "Project-only child", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../../.context/document-wiki-transfer.png",
    fullPage: true,
  });
});
