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
const technicalDiagramHrefPattern = /#technical-diagram-/;
const technicalDiagramsHrefPattern = /#technical-diagrams$/;

test("organizes Documents with a preview and preserves identity through Archive and Unarchive", async ({
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
  await page.goto(`/projects/${setup.projectId}#documents`);
  const surface = page.getByRole("region", { name: "Documents", exact: true });
  const editor = page.getByRole("region", { name: "Document", exact: true });
  async function createDocument(title: string) {
    await surface
      .getByRole("button", { name: "Create Document", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Create Document" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Create Document" }).click();
    await expect(editor.getByLabel("Title")).toHaveValue(title);
  }
  await createDocument("Planning root");
  await createDocument("Release child");
  await editor.getByRole("button", { name: "Organize Document" }).click();
  const organize = page.getByRole("dialog", { name: "Organize Document" });
  await organize.getByLabel("Folder", { exact: true }).fill("Planning");
  await organize
    .getByLabel("Parent Document", { exact: true })
    .selectOption({ label: "Planning root" });
  await organize.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(organize).toContainText("Document level: 2");
  await organize.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).not.toContainText("Folder: Planning");
  await editor.getByRole("button", { name: "Organize Document" }).click();
  await organize.getByLabel("Folder", { exact: true }).fill("Planning");
  await organize
    .getByLabel("Parent Document", { exact: true })
    .selectOption({ label: "Planning root" });
  await organize.getByRole("button", { name: "Preview", exact: true }).click();
  await organize.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(organize).toBeHidden();
  await expect(editor).toContainText("Folder: Planning");
  await editor.getByRole("button", { name: "Archive", exact: true }).click();
  const archive = page.getByRole("dialog", { name: "Archive", exact: true });
  await archive.getByRole("button", { name: "Preview", exact: true }).click();
  await archive.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    surface
      .getByRole("navigation", { name: "Documents" })
      .getByRole("button", { name: "Release child", exact: true }),
  ).toHaveCount(0);
  await surface
    .getByRole("checkbox", { name: "Archived", exact: true })
    .check();
  await surface
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Release child", exact: true })
    .click();
  await expect(editor).toContainText("Folder: Planning");
  await editor.getByRole("button", { name: "Unarchive", exact: true }).click();
  const unarchive = page.getByRole("dialog", {
    name: "Unarchive",
    exact: true,
  });
  await unarchive.getByRole("button", { name: "Preview", exact: true }).click();
  await unarchive.getByRole("button", { name: "Apply", exact: true }).click();
  await surface
    .getByRole("checkbox", { name: "Archived", exact: true })
    .uncheck();
  await page.reload();
  await surface
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Release child", exact: true })
    .click();
  await expect(editor).toContainText("Folder: Planning");
  await expect(editor).toContainText("Parent Document: Planning root");
  await page.screenshot({
    path: "../../.context/documents-organization.png",
    fullPage: true,
  });
  await surface
    .getByRole("checkbox", { name: "Archived", exact: true })
    .check();
  await createDocument("New active Document");
  await expect(
    surface.getByRole("checkbox", { name: "Archived", exact: true }),
  ).not.toBeChecked();
  await createDocument("Release detail");
  await editor.getByRole("button", { name: "Organize Document" }).click();
  await organize
    .getByLabel("Parent Document", { exact: true })
    .selectOption({ label: "Release child" });
  await organize.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(organize).toContainText("Document level: 3");
  await organize.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(organize).toBeHidden();
  await createDocument("Fourth level");
  await editor.getByRole("button", { name: "Organize Document" }).click();
  await organize
    .getByLabel("Parent Document", { exact: true })
    .selectOption({ label: "Release detail" });
  await organize.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(organize).toContainText(
    "Document hierarchy is limited to three levels.",
  );
  await expect(
    organize.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await organize.getByRole("button", { name: "Cancel", exact: true }).click();
  await surface
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Planning root", exact: true })
    .click();
  await editor.getByRole("button", { name: "Archive", exact: true }).click();
  await archive.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(archive).toContainText("Release child");
  await expect(archive).toContainText("Release detail");
  await archive.getByRole("button", { name: "Apply", exact: true }).click();
  await surface
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Release child", exact: true })
    .click();
  await expect(editor).toContainText("Parent Document: Planning root");
});

test("keeps Workspace tag identity in Document prose across dictionary rename", async ({
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
  await page.goto(`/projects/${setup.projectId}#tags`);
  await page.getByLabel("Name", { exact: true }).fill("release/test");
  await page.getByRole("button", { name: "Create tag" }).click();
  await expect(
    page.getByRole("combobox", { name: "Tag to rename" }),
  ).toContainText("release/test");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  const surface = page.getByRole("region", { name: "Documents", exact: true });
  await surface
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "Create Document" });
  await create.getByLabel("Title").fill("Tagged release notes");
  await create.getByRole("button", { name: "Create Document" }).click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Markdown source" })
    .fill("#release/test #unknown `#release/test`");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  const token = editor.getByRole("button", {
    name: "#release/test",
    exact: true,
  });
  await expect(token).toBeVisible();
  const tagId = await token.getAttribute("data-tag-id");
  expect(tagId).toBeTruthy();
  await page.getByRole("link", { name: "Tags", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Tag to rename" })
    .selectOption({ label: "release/test" });
  await page.getByLabel("New name").fill("Release planning");
  await page.getByRole("button", { name: "Rename Tag" }).click();
  await expect(page.getByText("Tag renamed.")).toBeVisible();
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await surface
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: "Tagged release notes", exact: true })
    .click();
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue("#[Release planning] #unknown `#release/test`");
  await expect(
    editor.getByRole("button", { name: "#Release planning", exact: true }),
  ).toHaveAttribute("data-tag-id", tagId ?? "");
});

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
  await expect(createDialog.getByLabel("Starter skeleton")).toHaveCount(0);
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
  let releaseUpdateStarted: () => void = () => undefined;
  const updateStarted = new Promise<void>((resolve) => {
    releaseUpdateStarted = resolve;
  });
  let delayNextUpdate = true;
  await page.route("**/rpc/updateDocument", async (route) => {
    if (delayNextUpdate) {
      delayNextUpdate = false;
      releaseUpdateStarted();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });
  await editor.getByRole("button", { name: "Save" }).click();
  await updateStarted;
  await expect(editor.getByLabel("Type")).toBeDisabled();
  await expect(editor.getByLabel("Type")).toBeEnabled();
  await editor.getByLabel("Type").selectOption("Spec");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByRole("button", { name: "Save" })).toBeEnabled();
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

test("creates selected Document starter skeletons from the Documents surface", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=documents-skeletons`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#documents`);

  const expectations = [
    {
      headings: [
        "Context",
        "Goals",
        "Behaviors",
        "Pain Points",
        "Constraints",
        "Evidence",
        "Open Questions",
      ],
      skeleton: "Persona",
      type: "Persona",
    },
    {
      headings: [
        "Period",
        "What worked?",
        "What did not?",
        "What did we learn?",
        "Decisions",
        "Next changes",
        "Related records",
      ],
      skeleton: "Retrospective",
      type: "General",
    },
    {
      headings: [
        "Release",
        "Audience",
        "Scope",
        "Readiness",
        "Communication",
        "Launch steps",
        "Risks",
        "Observation plan",
        "Related records",
      ],
      skeleton: "Launch Plan",
      type: "Plan",
    },
  ] as const;

  for (const { headings, skeleton, type } of expectations) {
    // biome-ignore lint/performance/noAwaitInLoops: Each created Document becomes the selected editor target before the next is created.
    await page.getByRole("button", { name: "Create Document" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Document" });
    const skeletonSelect = createDialog.getByLabel("Starter skeleton");
    await expect(skeletonSelect.locator("option")).toHaveText([
      "No starter skeleton",
      "Persona",
      "Retrospective",
      "Launch Plan",
    ]);
    await skeletonSelect.selectOption(skeleton);
    await expect(createDialog.getByLabel("Title")).toBeHidden();
    await expect(createDialog.getByLabel("Type")).toBeHidden();
    await createDialog.getByRole("button", { name: "Create Document" }).click();

    const editor = page.getByRole("region", { name: "Document", exact: true });
    await expect(editor.getByLabel("Title")).toHaveValue(skeleton);
    await expect(editor.getByLabel("Type")).toHaveValue(type);
    await editor.getByRole("tab", { name: "Markdown" }).click();
    await expect(
      editor.getByRole("textbox", { name: "Markdown source" }),
    ).toHaveValue(headings.map((heading) => `## ${heading}`).join("\n\n"));
  }

  await page.getByRole("button", { name: "Create Document" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create Document" });
  await createDialog.getByLabel("Starter skeleton").selectOption("");
  await expect(createDialog.getByLabel("Title")).toBeVisible();
  await expect(createDialog.getByLabel("Type")).toBeVisible();
  await createDialog.getByLabel("Title").fill("Plain Document");
  await createDialog.getByLabel("Type").selectOption("Research Note");
  await createDialog.getByRole("button", { name: "Create Document" }).click();

  const editor = page.getByRole("region", { name: "Document", exact: true });
  await expect(editor.getByLabel("Title")).toHaveValue("Plain Document");
  await expect(editor.getByLabel("Type")).toHaveValue("Research Note");
  await editor.getByRole("tab", { name: "Markdown" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Markdown source" }),
  ).toHaveValue("");
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
  await expect(
    editor.getByRole("link", { name: "Technical Diagrams" }),
  ).toHaveAttribute("href", technicalDiagramsHrefPattern);
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
  await expect(
    editor.getByText("Technical Diagram: Architecture notes"),
  ).toBeVisible();
  await expect(
    editor.getByRole("link", { name: "Open source record" }),
  ).toHaveAttribute("href", technicalDiagramHrefPattern);
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
  await editor
    .getByRole("tabpanel", { name: "Preview" })
    .getByRole("link", { name: "Open source record" })
    .click();
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
  await richEditor.selectText();
  await document.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("URL", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Use an http, https, or mailto URL." }),
  ).toHaveText("Use an http, https, or mailto URL.");
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
