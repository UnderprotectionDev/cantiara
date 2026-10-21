import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

const liveDiagramPattern = /:::live-diagram\{diagramId="/;

test("keyboard-reachable structured outline, Diagram View and Diagram Version", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = (await response.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#technical-diagrams`);

  const surface = page.getByRole("region", {
    exact: true,
    name: "Technical Diagram",
  });
  const create = surface.getByRole("form", { name: "New Technical Diagram" });
  await create.getByLabel("Title").fill("Platform");
  await create.getByRole("button", { exact: true, name: "Create" }).click();

  const card = surface.getByRole("article");
  await expect(card).toContainText("Platform");
  await card.getByLabel("Node label").fill("API");
  await card.getByRole("button", { exact: true, name: "Add node" }).click();
  const outline = card.getByRole("region", {
    name: "Technical Diagram outline",
  });
  await expect(outline).toContainText("API · Component");

  const view = card.getByRole("region", { exact: true, name: "Diagram View" });
  await view.getByLabel("Name", { exact: true }).fill("API only");
  await view.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(view).toContainText("API only: 1 nodes");

  const versions = card.getByRole("region", {
    exact: true,
    name: "Diagram Version",
  });
  await versions.getByLabel("Diagram Version name").fill("Baseline");
  await versions
    .getByRole("button", { exact: true, name: "Create Diagram Version" })
    .click();
  await expect(versions.getByRole("list")).toContainText("Baseline");

  await card.getByLabel("Node label").fill("Cache");
  await card.getByRole("button", { exact: true, name: "Add node" }).click();
  await expect(outline).toContainText("Cache · Component");

  await versions
    .getByRole("button", { name: "Restore Diagram Version Baseline" })
    .click();
  await expect(outline).not.toContainText("Cache");
  await expect(outline).toContainText("API · Component");
  await expect(versions.getByRole("list")).toContainText("Baseline");
  await expect(versions).toContainText("the Diagram Version stays unchanged");
});

test("Mermaid'den Teknik Diyagram dönüşümü", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(response.ok()).toBe(true);
  const setup = (await response.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#documents`);
  await page.getByRole("button", { name: "Create Document" }).click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title").fill("Platform notes");
  await create.getByRole("button", { name: "Create Document" }).click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor
    .getByLabel("Markdown source")
    .fill(
      "```mermaid\ngraph TD\nweb[Web] --> api[API]\nclassDef x fill:red\n```",
    );
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByRole("tab", { name: "Preview" }).click();

  // Keyboard-only: a named button opens the dialog, and the preview names
  // every consequence before the one confirmation.
  await editor
    .getByRole("button", { name: "Convert to Technical Diagram" })
    .focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Convert to Technical Diagram",
  });
  await expect(dialog).toBeVisible();
  const preview = dialog.getByRole("region", { name: "Conversion preview" });
  await expect(preview).toContainText("Imported Independent Copy");
  await expect(preview).toContainText("Originates from Platform notes");
  await expect(preview).toContainText("classDef x fill:red");
  await expect(preview).toContainText("No live round-trip");
  await dialog
    .getByLabel("Original Mermaid block")
    .selectOption("Replace with live reference");
  await expect(preview).toContainText("live Technical Diagram reference");
  await dialog
    .getByRole("button", { name: "Convert to Technical Diagram" })
    .click();
  await expect(dialog).not.toBeVisible();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(editor.getByLabel("Markdown source")).toHaveValue(
    liveDiagramPattern,
  );
});
