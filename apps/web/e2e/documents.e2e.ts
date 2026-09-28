import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const richEditPattern = /Rich edit/;
const mermaidSourcePattern = /graph TD; A-->B;/;
const latexSourcePattern = /\$\$\s*x\^2\s*\$\$/;
const bulletListPattern = /^- /;
const tablePattern = /\|/;
const linkPattern = /https:\/\/example\.com/;

test("creates and edits a database-backed Document while preserving technical Markdown source", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);

  await page.goto(`/projects/${setup.projectId}#documents`);
  await expect(
    page.getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Title").first().fill("Architecture Notes");
  await page.getByRole("button", { name: "Create Document" }).click();

  const editor = page.getByRole("region", { name: "Document", exact: true });
  await expect(editor.getByLabel("Title")).toHaveValue("Architecture Notes");
  const source =
    "| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst n = 1;\n```\n\n```mermaid\ngraph TD; A-->B;\n```\n\n$$x^2$$\n\nHello $x$ world\n\nHello `code` world\n\n`$$y$$`\n\n````text\n$$z$$\n````";
  await editor.getByLabel("Markdown").fill(source);
  const inlineParagraph = editor
    .getByLabel("Document preview")
    .locator("p")
    .filter({ hasText: "Hello" })
    .first();
  await expect(inlineParagraph).toContainText("world");
  await expect(inlineParagraph.locator(".katex")).toBeVisible();
  const codeParagraph = editor
    .getByLabel("Document preview")
    .locator("p")
    .filter({ hasText: "Hello" })
    .filter({ hasText: "code" });
  await expect(codeParagraph).toContainText("world");
  await expect(codeParagraph.locator("code")).toHaveText("code");
  await expect(
    editor.getByLabel("Document preview").locator(".katex"),
  ).toHaveCount(2);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByLabel("Markdown")).toHaveValue(source);

  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Architecture Notes" })
    .click();
  await expect(editor.getByLabel("Markdown")).toHaveValue(source);
  await editor.locator("[contenteditable='true']").click();
  await editor.locator("[contenteditable='true']").press("ControlOrMeta+End");
  await editor.locator("[contenteditable='true']").press("Enter");
  await editor.locator("[contenteditable='true']").type("Rich edit");
  await expect(editor.getByLabel("Markdown")).toHaveValue(richEditPattern);
  await expect(editor.getByLabel("Markdown")).toHaveValue(mermaidSourcePattern);
  await expect(editor.getByLabel("Markdown")).toHaveValue(latexSourcePattern);
  const editedSource = await editor.getByLabel("Markdown").inputValue();
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByLabel("Type").selectOption("Spec");
  await editor.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Architecture Notes" })
    .click();
  await expect(editor.getByLabel("Type")).toHaveValue("Spec");
  await expect(editor.getByLabel("Markdown")).toHaveValue(editedSource);

  await editor
    .getByLabel("Markdown")
    .fill(`${editedSource}\n\n$$\\badCommand$$`);
  await expect(
    editor.getByRole("alert").filter({ hasText: "KaTeX parse error" }),
  ).toBeVisible();
  await expect(editor.getByLabel("Markdown")).toHaveValue(
    `${editedSource}\n\n$$\\badCommand$$`,
  );

  const invalidDiagram = `${editedSource}\n\n\`\`\`mermaid\nnot a diagram\n\`\`\``;
  await editor.getByLabel("Markdown").fill(invalidDiagram);
  await expect(editor.getByRole("alert").first()).toBeVisible();
  await expect(editor.getByLabel("Markdown")).toHaveValue(invalidDiagram);
});

test("formats a Document from the rich editor toolbar", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#documents`);
  await page.getByLabel("Title").first().fill("Formatting Notes");
  await page.getByRole("button", { name: "Create Document" }).click();

  const document = page.getByRole("region", { name: "Document", exact: true });
  const richEditor = document.locator("[contenteditable='true']");
  await expect(
    document.getByRole("toolbar", { name: "Document formatting" }),
  ).toBeVisible();
  await richEditor.fill("A clear priority");
  await richEditor.press("ControlOrMeta+a");
  await document.getByRole("button", { name: "Bold" }).click();
  await expect(document.getByLabel("Markdown")).toHaveValue(
    "**A clear priority**",
  );
  await document.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Use an http, https, or mailto URL.",
  );
  await page.getByLabel("URL", { exact: true }).fill("https://example.com");
  await page.getByRole("button", { name: "Apply link" }).click();
  await expect(document.getByLabel("Markdown")).toHaveValue(linkPattern);
  await document.getByRole("button", { name: "Bullet list" }).click();
  await expect(document.getByLabel("Markdown")).toHaveValue(bulletListPattern);
  await document.getByRole("button", { name: "Insert table" }).click();
  await expect(document.getByLabel("Markdown")).toHaveValue(tablePattern);
  await expect(document.getByRole("button", { name: "Add row" })).toBeVisible();
  await document.getByRole("button", { name: "Add row" }).click();
});
