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
    "| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst n = 1;\n```\n\n  ```mermaid\ngraph TD; A-->B;\n   ````\n\n   ~~~mermaid\ngraph TD; C-->D;\n  ~~~~\n\n$$x^2$$\n\nHello $x$ world\n\nHello `code` world\n\n`$$y$$`\n\n````text\n$$z$$\n````";
  await editor.getByRole("textbox", { name: "Markdown source" }).fill(source);
  await editor.getByRole("tab", { name: "Preview" }).click();
  const preview = editor.getByLabel("Document preview");
  await expect(
    preview.getByRole("img", { name: "Mermaid diagram" }),
  ).toHaveCount(2);
  await expect(preview.getByText("`", { exact: true })).toHaveCount(0);
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

test("a live Work block follows the source and uses ordinary status actions", async ({
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
  await createDialog.getByLabel("Title").fill("Work notes");
  await createDialog.getByRole("button", { name: "Create Document" }).click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor.getByLabel("Live Work block").selectOption({
    label: "DOCS-1 · Live Work source",
  });
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(
    editor.getByRole("region", { name: "Live Work block" }),
  ).toContainText("Live Work source");
  await editor.getByRole("button", { name: "Save" }).click();
  const block = editor.getByRole("region", { name: "Live Work block" });
  await expect(block).toContainText("Live Work source");
  await expect(block).toContainText("Not Started");

  await block.getByRole("button", { name: "Change status" }).click();
  const statusDialog = page.getByRole("dialog", { name: "Change status" });
  const statusSaved = page.waitForResponse(
    (response) => response.url().includes("updateWorkStatus") && response.ok(),
  );
  await statusDialog
    .getByRole("combobox", { name: "Status for DOCS-1" })
    .selectOption("In Progress");
  await statusSaved;
  await page.keyboard.press("Escape");
  await expect(block).toContainText("In Progress");

  await block.getByRole("button", { name: "Close", exact: true }).click();
  const closeDialog = page.getByRole("dialog", { name: "Close", exact: true });
  await closeDialog
    .getByRole("combobox", { name: "Closure result for DOCS-1" })
    .selectOption("Completed");
  const closeSaved = page.waitForResponse(
    (response) => response.url().includes("closeWork") && response.ok(),
  );
  await closeDialog
    .getByRole("dialog", { name: "Close DOCS-1" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await closeSaved;
  await page.keyboard.press("Escape");
  await expect(block).toContainText("Closed");

  await page.reload();
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Work notes" })
    .click();
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(
    editor.getByRole("region", { name: "Live Work block" }),
  ).toContainText("Closed");

  await editor.getByRole("tab", { name: "Markdown" }).click();
  const markdown = editor.getByRole("textbox", { name: "Markdown source" });
  await markdown.fill(
    `${await markdown.inputValue()}\n:::live-work{workId="missing"}`,
  );
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByRole("tab", { name: "Preview" }).click();
  const broken = editor.getByRole("region", { name: "Live Work block" }).last();
  await expect(broken).toContainText("Source record is unavailable.");
  await expect(broken.getByRole("button")).toHaveCount(0);
});

test("a named Smart Collection view stays live in a Document", async ({
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
  await page.goto(`/projects/${setup.projectId}#smart-collections`);
  const collection = page.getByRole("region", { name: "Smart Collection" });
  await collection.getByLabel("Name", { exact: true }).fill("Active Work");
  await collection.getByLabel("Named view").fill("Current list");
  await collection.getByLabel("Status").selectOption("Not Started");
  await collection.getByRole("button", { name: "Save" }).click();
  await expect(collection).toContainText("DOCS-1");

  await page.goto(`/projects/${setup.projectId}#documents`);
  await page.getByRole("button", { name: "Create Document" }).click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title").fill("Collection notes");
  await create.getByRole("button", { name: "Create Document" }).click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor
    .getByLabel("Named view")
    .selectOption({ label: "Active Work · Current list" });
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(
    editor.getByRole("region", { name: "Smart Collection" }),
  ).toContainText("DOCS-1");
  await editor.getByRole("link", { name: "Open source record" }).click();
  await expect(
    page.getByRole("region", { name: "Smart Collection" }),
  ).toContainText("Active Work · Current list");
});

test("converts saved Mermaid into an independent Technical Diagram and embeds it read-only", async ({
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
  await create.getByLabel("Title").fill("Architecture notes");
  await create.getByRole("button", { name: "Create Document" }).click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor
    .getByLabel("Markdown source")
    .fill("```mermaid\ngraph TD\nweb[Web] --> api[API]\n```");
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByRole("tab", { name: "Preview" }).click();
  await editor
    .getByRole("button", { name: "Convert to Technical Diagram" })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Convert to Technical Diagram",
  });
  await expect(preview).toContainText("Imported Independent Copy");
  await expect(preview).toContainText("2 nodes · 1 links");
  await preview
    .getByRole("button", { name: "Convert to Technical Diagram" })
    .click();
  await expect(preview).not.toBeVisible();
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await editor
    .getByLabel("Technical Diagram")
    .selectOption({ label: "Architecture notes · Technical Architecture" });
  await editor.getByLabel("Diagram View").selectOption({ label: "Default" });
  await editor.getByRole("button", { name: "Save" }).click();
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(
    editor.getByRole("region", { name: "Technical Diagram" }),
  ).toContainText("Web");
  await expect(
    editor.getByRole("region", { name: "Technical Diagram" }),
  ).toContainText("API");
  await editor.getByRole("link", { name: "Open source record" }).click();
  const source = page.getByRole("region", { name: "Technical Diagram" });
  await source.getByLabel("Name", { exact: true }).fill("Web only");
  await source.getByRole("checkbox", { name: "API" }).uncheck();
  await source.getByRole("button", { name: "Save" }).click();
  await expect(source).toContainText("Web only: 1 nodes");
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
