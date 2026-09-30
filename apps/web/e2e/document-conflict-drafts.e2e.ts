import { readFile } from "node:fs/promises";
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { expect, type Page, test } from "@playwright/test";

import { formatAccountDateTime } from "../src/features/account-preferences/lib/account-preferences-format";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

async function openDocument(page: Page, route: string, title: string) {
  await page.goto(route);
  await page
    .getByRole("navigation", { name: "Documents" })
    .getByRole("button", { name: title, exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(title);
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  return editor;
}

async function saveBody(page: Page, body: string, conflict = false) {
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill(body);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  if (!conflict) {
    await expect(
      editor.getByRole("button", { name: "Save", exact: true }),
    ).toBeEnabled();
  }
}

test("compares and resolves stale text through apply, independent creation, cancellation, and deletion", async ({
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
  const route = `/projects/${setup.projectId}#documents`;
  await page.goto(route);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create Document",
    exact: true,
  });
  await create.getByLabel("Title", { exact: true }).fill("Conflict Notes");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const second = await context.newPage();
  const draftList: { failing: boolean; requests: number } = {
    failing: false,
    requests: 0,
  };
  await second.route(
    "**/rpc/documentConflictDrafts",
    async (draftListRequest) => {
      draftList.requests += 1;
      if (draftList.failing) {
        await draftListRequest.abort();
        return;
      }
      await draftListRequest.continue();
    },
  );
  await openDocument(second, route, "Conflict Notes");
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  await saveBody(page, "Current text");
  const initialDraftListRequests = draftList.requests;
  draftList.failing = true;
  await saveBody(second, "Rejected text", true);
  const drafts = second.getByRole("region", {
    name: "Conflict Drafts",
    exact: true,
  });
  await expect(drafts).toBeVisible();
  await expect(drafts).toContainText("Conflict Drafts could not be loaded.");
  await expect(
    drafts.getByRole("button", { name: "Compare", exact: true }),
  ).toBeVisible();
  await second.waitForTimeout(250);
  expect(draftList.requests).toBe(initialDraftListRequests + 1);
  draftList.failing = false;
  await expect(
    second.getByText(
      "Your changes were kept in a Conflict Draft. Choose Compare in the Document to resolve it.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    second.getByText("This page is out of date.", { exact: true }),
  ).toHaveCount(0);
  await second.locator("[data-sonner-toast]").first().screenshot({
    path: "../../.context/document-conflict-notice.png",
  });
  await expect(
    second
      .getByRole("region", { name: "Document", exact: true })
      .getByRole("textbox", { name: "Markdown source", exact: true })
      .first(),
  ).toBeDisabled();
  await drafts.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    drafts.getByRole("region", { name: "Compare", exact: true }),
  ).toContainText("Current text");
  await drafts
    .getByLabel("Markdown source", { exact: true })
    .fill("Current text\nSelected rejected part");
  await drafts
    .getByRole("button", { name: "Apply parts", exact: true })
    .click();
  await expect(drafts).toBeHidden();
  await expect(
    second
      .getByRole("region", { name: "Versions", exact: true })
      .getByRole("button", { name: "Version 3", exact: true }),
  ).toBeVisible();
  await second.getByRole("tab", { name: "Write", exact: true }).click();
  await expect(
    second.getByLabel("Document editor", { exact: true }),
  ).toContainText("Selected rejected part");
  await second.reload();
  await openDocument(second, route, "Conflict Notes");
  await expect(
    second.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toHaveValue("Current text\nSelected rejected part");
  await saveBody(page, "Independent rejected text", true);
  const sourceDrafts = page.getByRole("region", {
    name: "Conflict Drafts",
    exact: true,
  });
  await expect(sourceDrafts).toBeVisible();
  await sourceDrafts
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await sourceDrafts
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  await create.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sourceDrafts).toBeVisible();
  await sourceDrafts
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  await create.getByLabel("Title", { exact: true }).fill("Recovered Notes");
  await create
    .getByLabel("Markdown source", { exact: true })
    .fill("Selected independent text");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  await expect(sourceDrafts).toBeHidden();
  await page.reload();
  await openDocument(page, route, "Recovered Notes");
  await expect(
    page.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toHaveValue("Selected independent text");
  await page
    .getByRole("link", { name: "Open source record", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Document", exact: true })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Conflict Notes");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await saveBody(page, "Latest source");
  await saveBody(second, "Delete rejected text", true);
  await drafts.getByRole("button", { name: "Compare", exact: true }).click();
  await drafts.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(drafts).toBeHidden();
  await second.reload();
  await openDocument(second, route, "Conflict Notes");
  await expect(drafts).toBeHidden();
  await expect(
    second.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toHaveValue("Latest source");
});

test("freezes disconnected edits and recovers a stale reconnect without silently overwriting", async ({
  browser,
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
  const route = `/projects/${setup.projectId}#documents`;
  await page.goto(route);
  await page
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create Document",
    exact: true,
  });
  await create.getByLabel("Title", { exact: true }).fill("Reconnect Notes");
  await create
    .getByRole("button", { name: "Create Document", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Document", exact: true });
  await editor.getByRole("tab", { name: "Markdown", exact: true }).click();
  const otherContext = await browser.newContext();
  await otherContext.addCookies([setup.cookie]);
  const otherPage = await otherContext.newPage();
  await openDocument(otherPage, route, "Reconnect Notes");
  await editor
    .getByRole("textbox", { name: "Markdown source", exact: true })
    .fill("Unwritten reconnect text");
  await context.setOffline(true);
  await expect(
    editor.getByRole("textbox", { name: "Markdown source", exact: true }),
  ).toBeDisabled();
  await expect(editor).toContainText("Last successful save:");
  await expect(editor).toContainText("Unsaved changes may be lost");
  const lastSaved = editor.locator("time");
  const lastSavedAt = await lastSaved.getAttribute("datetime");
  if (!lastSavedAt) {
    throw new Error("The last successful save time is required.");
  }
  await expect(lastSaved).toHaveText(
    formatAccountDateTime(lastSavedAt, DEFAULT_ACCOUNT_PREFERENCES),
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await editor.getByRole("button", { name: "Copy", exact: true }).click();
  await expect
    .poll(async () => {
      const contents = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      try {
        return JSON.parse(contents);
      } catch {
        return null;
      }
    })
    .toEqual({
      body: "Unwritten reconnect text",
      title: "Reconnect Notes",
      type: "General",
    });
  const downloaded = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Download", exact: true }).click();
  const recovery = await downloaded;
  expect(recovery.suggestedFilename()).toBe("document-recovery.json");
  const recoveryPath = await recovery.path();
  if (!recoveryPath) {
    throw new Error("The recovery download is required.");
  }
  expect(JSON.parse(await readFile(recoveryPath, "utf8"))).toEqual({
    body: "Unwritten reconnect text",
    title: "Reconnect Notes",
    type: "General",
  });
  await saveBody(otherPage, "Competing current text");
  await context.setOffline(false);
  const drafts = page.getByRole("region", {
    name: "Conflict Drafts",
    exact: true,
  });
  await expect(drafts).toBeVisible();
  await drafts.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    drafts.getByRole("region", { name: "Compare", exact: true }),
  ).toContainText("Unwritten reconnect text");
  await expect(
    drafts.getByRole("region", { name: "Compare", exact: true }),
  ).toContainText("Competing current text");
  await drafts.screenshot({
    path: "../../.context/document-conflict-reconnect.png",
  });
  await otherContext.close();
});
