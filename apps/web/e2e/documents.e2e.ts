import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const richEditPattern = /Rich edit/;
const mermaidSourcePattern = /graph TD; A-->B;/;
const latexSourcePattern = /\$\$\s*x\^2\s*\$\$/;
const bulletListPattern = /^- /;
const tablePattern = /\|/;
const linkPattern = /https:\/\/example\.com/;
const typescriptFencePattern = /```typescript/;
const blockFormulaPattern = /\$\$[\s\S]*x\^2/;

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
  await page.getByRole("button", { name: "Create Document" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create Document" });
  await createDialog.getByLabel("Title").fill("Architecture Notes");
  await createDialog.getByRole("button", { name: "Create Document" }).click();

  const editor = page.getByRole("region", { name: "Document", exact: true });
  await expect(editor.getByLabel("Title")).toHaveValue("Architecture Notes");
  await expect(editor.getByRole("tab", { name: "Write" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toBeHidden();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  const source =
    "| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst n = 1;\n```\n\n```mermaid\ngraph TD; A-->B;\n```\n\n$$x^2$$\n\nHello $x$ world\n\nHello `code` world\n\n`$$y$$`\n\n````text\n$$z$$\n````";
  await editor.getByRole("textbox", { name: "Markdown source" }).fill(source);
  await editor.getByRole("tab", { name: "Preview" }).click();
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
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(source);

  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Architecture Notes" })
    .click();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(source);
  await editor
    .getByRole("textbox", { name: "Markdown source" })
    .fill(`${source}\n\nRich edit`);
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(richEditPattern);
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(mermaidSourcePattern);
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(latexSourcePattern);
  const editedSource = await editor
    .getByRole("textbox", { name: "Markdown source" })
    .inputValue();
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByLabel("Type").selectOption("Spec");
  await editor.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Architecture Notes" })
    .click();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(editor.getByLabel("Type")).toHaveValue("Spec");
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(editedSource);

  await editor
    .getByRole("textbox", { name: "Markdown source" })
    .fill(`${editedSource}\n\n$$\\badCommand$$`);
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(
    editor.getByRole("alert").filter({ hasText: "KaTeX parse error" }),
  ).toBeVisible();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(`${editedSource}\n\n$$\\badCommand$$`);

  const invalidDiagram = `${editedSource}\n\n\`\`\`mermaid\nnot a diagram\n\`\`\``;
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source" })
    .fill(invalidDiagram);
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(editor.getByRole("alert").first()).toBeVisible();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(invalidDiagram);
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
  await page.getByRole("button", { name: "Create Document" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create Document" });
  await createDialog.getByLabel("Title").fill("Formatting Notes");
  await createDialog.getByRole("button", { name: "Create Document" }).click();

  const document = page.getByRole("region", { name: "Document", exact: true });
  const richEditor = document.locator("[contenteditable='true']");
  await expect(createDialog).toBeHidden();
  await expect(document.getByRole("tab", { name: "Write" })).toBeVisible();
  await expect(
    document.getByRole("toolbar", { name: "Document formatting" }),
  ).toBeVisible();
  await richEditor.fill("A clear priority");
  await richEditor.press("ControlOrMeta+a");
  await document.getByRole("button", { name: "Bold" }).click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue("**A clear priority**");
  await document.getByRole("tab", { name: "Write" }).click();
  await document.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Use an http, https, or mailto URL.",
  );
  await page.getByLabel("URL", { exact: true }).fill("https://example.com");
  await page.getByRole("button", { name: "Apply link" }).click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(linkPattern);
  await document.getByRole("tab", { name: "Write" }).click();
  await document.getByRole("button", { name: "Bullet list" }).click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(bulletListPattern);
  await document.getByRole("tab", { name: "Write" }).click();
  await document.getByRole("button", { name: "Insert table" }).click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(tablePattern);
  await document.getByRole("tab", { name: "Write" }).click();
  await richEditor.locator("table td").first().click();
  await expect(document.getByRole("button", { name: "Add row" })).toBeVisible();
  await document.getByRole("button", { name: "Add row" }).click();
});

test("keeps unsupported Markdown source intact when Write cannot round-trip it", async ({
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

  await page.getByRole("button", { name: "Create Document" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create Document" });
  await createDialog.getByLabel("Title").fill("Not created");
  await createDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(createDialog).toBeHidden();
  await expect(
    page
      .getByRole("navigation", { name: "Documents" })
      .getByText("Not created"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Create Document" }).click();
  await createDialog.getByLabel("Title").fill("Source Safety Notes");
  await createDialog.getByRole("button", { name: "Create Document" }).click();
  const document = page.getByRole("region", { name: "Document", exact: true });
  await document.getByRole("tab", { name: "Markdown" }).click();
  const source = "<!-- keep this note -->\n\n# Stable heading";
  await document.getByRole("textbox", { name: "Markdown source" }).fill(source);
  await document.getByRole("tab", { name: "Write" }).click();
  await expect(document.getByRole("tab", { name: "Markdown" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(document.getByRole("alert")).toContainText(
    "cannot be safely converted",
  );
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(source);
  await document.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Source Safety Notes" })
    .click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(source);
});

test("adds a highlighted code block and a formula from Write", async ({
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
  await page.getByRole("button", { name: "Create Document" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create Document" });
  await createDialog.getByLabel("Title").fill("Technical Notes");
  await createDialog.getByRole("button", { name: "Create Document" }).click();

  const document = page.getByRole("region", { name: "Document", exact: true });
  const richEditor = document.locator("[contenteditable='true']");
  await richEditor.fill("const value = 1;");
  await document.getByRole("button", { name: "Code block" }).click();
  await document
    .getByRole("combobox", { name: "Code language" })
    .selectOption("typescript");
  await expect(richEditor.locator("pre .hljs-keyword")).toContainText("const");
  await richEditor.press("ControlOrMeta+End");
  await richEditor.press("ArrowDown");
  await document.getByRole("button", { name: "Insert formula" }).click();
  await page.getByLabel("LaTeX").fill("x^2");
  await page.getByLabel("Placement").selectOption("block");
  await page.getByRole("button", { name: "Insert formula" }).last().click();
  await document.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(typescriptFencePattern);
  await expect(
    document.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue(blockFormulaPattern);
});
