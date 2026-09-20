import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const TAGS_HASH_PATTERN = /#tags$/;
const ROADMAP_TAG_PATTERN = /^roadmap\/next/;

test("classifies Work records with one Workspace tag dictionary", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=tags`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    projectId: string;
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  await page.goto(`/projects/${setup.projectId}`);
  await page.getByRole("link", { name: "Tags", exact: true }).click();
  await expect(page).toHaveURL(TAGS_HASH_PATTERN);
  await expect(page.locator("#tags")).toBeVisible();

  const recordList = page.getByRole("list", { name: "Tagged Work records" });
  await expect(recordList.getByText("Prepare launch")).toBeVisible();
  await expect(recordList.getByText("Review launch")).toBeVisible();

  // One flat Workspace identity: the same visible name cannot mint a second Tag.
  const nameInput = page.getByLabel("Name", { exact: true });
  const createButton = page.getByRole("button", { name: "Create tag" });
  const tagFilter = page.getByRole("combobox", { name: "Filter by tag" });
  await nameInput.fill("roadmap/next");
  await createButton.click();
  await expect(tagFilter).toContainText("roadmap/next");

  const duplicateCreateResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/createTag"),
  );
  await nameInput.fill("roadmap/next");
  await createButton.click();
  await duplicateCreateResponse;
  await expect(
    tagFilter.locator("option", { hasText: "roadmap/next" }),
  ).toHaveCount(1);

  // Applying a tag is membership only and never deletes the identity.
  await page.getByLabel("Apply tag").first().selectOption({
    label: "roadmap/next",
  });
  await page.getByRole("button", { name: "Apply tag" }).first().click();
  await expect(
    page.getByRole("button", {
      name: "Remove tag roadmap/next from Prepare launch",
    }),
  ).toBeVisible();

  // Filtering matches the tag identity.
  const roadmapOption = tagFilter.locator("option", {
    hasText: ROADMAP_TAG_PATTERN,
  });
  await roadmapOption.waitFor({ state: "attached" });
  const roadmapOptionValue = await roadmapOption.getAttribute("value");
  await tagFilter.selectOption(roadmapOptionValue ?? "");
  await expect(recordList.getByText("Prepare launch")).toBeVisible();
  await expect(recordList.getByText("Review launch")).toBeHidden();

  await page
    .getByRole("button", {
      name: "Remove tag roadmap/next from Prepare launch",
    })
    .click();
  await expect(page.getByText("No matching records.")).toBeVisible();

  await tagFilter.selectOption({ label: "All tags" });
  await expect(recordList.getByText("Prepare launch")).toBeVisible();
  await expect(recordList.getByText("Review launch")).toBeVisible();
  await expect(
    recordList.getByText("No tags yet.", { exact: true }).first(),
  ).toBeVisible();
  await expect(tagFilter).toContainText("roadmap/next");
});
