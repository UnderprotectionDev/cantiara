// biome-ignore-all lint/performance/noAwaitInLoops: Source preview journeys share one browser and must run in order.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const favoritesWritePattern = /\/(addToFavorites|removeFromFavorites)$/;
const darkThemePattern = /dark/;

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("Favorites recovers source access from a refreshed list while the panel stays open", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-sources`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}`);
  const sourceUrl = page.url();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  const list = page.getByRole("dialog", { name: "Favorites", exact: true });
  const open = list.getByRole("button", {
    name: "Open source record: Favorite Document",
    exact: true,
  });
  await expect(open).toBeVisible();
  await page.route("**/rpc/openFavoriteSource", async (route) => {
    const opened = await route.fetch();
    const payload = await opened.json();
    const { sourceRecordId, sourceRecordType, addedAt } = payload.json;
    await route.fulfill({
      response: opened,
      json: {
        json: {
          sourceRecordId,
          sourceRecordType,
          addedAt,
          status: "unavailable",
          reason: "No access",
        },
      },
    });
  });
  await open.click();
  await expect(open).toHaveCount(0);
  await expect(
    list.getByText("Favorite Document", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/rpc/openFavoriteSource");
  const refreshed = page.waitForResponse("**/rpc/favoritesList");
  // Exercise the normal focus refresh without unmounting the Favorites panel.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    window.dispatchEvent(new Event("visibilitychange"));
  });
  expect((await refreshed).ok()).toBe(true);
  await expect(list).toBeVisible();
  await expect(open).toBeVisible();
  await open.click();
  await expect(
    page.getByRole("dialog", { name: "Favorite Document", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(sourceUrl);
});

test("Favorites membership persists, supports keyboard input, and retains its state after a failed removal", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Favorites Persistence");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Favorites Persistence", exact: true })
    .click();
  const overview = page.locator("#overview");
  const add = overview.getByRole("button", {
    name: "Add to Favorites",
    exact: true,
  });
  await expect(add).toBeEnabled();
  await add.focus();
  await page.keyboard.press("Enter");
  const remove = overview.getByRole("button", {
    name: "Remove from Favorites",
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await page.reload();
  await expect(remove).toBeEnabled();
  await page.route("**/rpc/removeFromFavorites", (route) => route.abort());
  await remove.click();
  await expect(overview.getByRole("alert")).toBeVisible();
  await expect(remove).toBeEnabled();
  await page.unroute("**/rpc/removeFromFavorites");
  await remove.click();
  await expect(add).toBeEnabled();
  await page.reload();
  await expect(add).toBeEnabled();
  await expect(overview.getByText("Active", { exact: true })).toBeVisible();
});

test("Decision Favorites preserves its source content and life across membership changes", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-decisions`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}#decisions`);
  await page
    .getByRole("region", { name: "Decisions", exact: true })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Favorite release decision");
  await page
    .getByLabel("Decision text", { exact: true })
    .fill("Keep the source unchanged.");
  await page
    .getByLabel("Rationale (optional)", { exact: true })
    .fill("Personal access only.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Decision saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Favorite release decision", exact: true })
    .click();
  const detail = page.getByRole("article", { name: "Decision", exact: true });
  const decisionsSurface = page
    .getByRole("region", { name: "Decisions", exact: true })
    .locator("..");
  const add = decisionsSurface.getByRole("button", {
    name: "Add to Favorites",
    exact: true,
  });
  await expect(add).toBeEnabled({ timeout: 5000 });
  await add.click();
  const remove = decisionsSurface.getByRole("button", {
    name: "Remove from Favorites",
    exact: true,
  });
  await expect(remove).toBeEnabled();
  await page.reload();
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(add).toBeEnabled();
  await page.reload();
  await expect(add).toBeEnabled();
  await expect(detail).toContainText("Valid");
  await expect(detail).toContainText("Keep the source unchanged.");
  await expect(detail).toContainText("Personal access only.");
});

test("the shell opens Favorites and its original source without writing membership", async ({
  context,
  page,
  request,
}) => {
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-list`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Favorites Source Project");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Favorites Source Project", exact: true })
    .click();
  const sourceUrl = page.url();
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Favorites", exact: true }),
  ).toContainText("No Favorites yet.");
  await page.keyboard.press("Escape");
  const overview = page.locator("#overview");
  await overview
    .getByRole("button", { name: "Add to Favorites", exact: true })
    .click();
  await expect(
    overview.getByRole("button", {
      name: "Remove from Favorites",
      exact: true,
    }),
  ).toBeEnabled();
  const writes: string[] = [];
  page.on("request", (outgoingRequest) => {
    if (favoritesWritePattern.test(outgoingRequest.url())) {
      writes.push(outgoingRequest.url());
    }
  });
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  const favorites = page.getByRole("dialog", {
    name: "Favorites",
    exact: true,
  });
  await expect(
    favorites.getByRole("heading", { name: "Favorites", exact: true }),
  ).toBeVisible();
  const open = favorites.getByRole("button", {
    name: "Open source record: Favorites Source Project",
    exact: true,
  });
  await open.focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("dialog", {
    name: "Favorites Source Project",
    exact: true,
  });
  await expect(
    preview.getByRole("heading", {
      name: "Favorites Source Project",
      exact: true,
    }),
  ).toBeVisible();
  expect(page.url()).toBe(sourceUrl);
  await preview
    .getByRole("link", { name: "Open full page", exact: true })
    .click();
  await expect(
    overview.getByRole("button", {
      name: "Remove from Favorites",
      exact: true,
    }),
  ).toBeEnabled();
  expect(page.url().split("#")[0]).toBe(sourceUrl.split("#")[0]);
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(
    favorites.getByRole("button", {
      name: "Open source record: Favorites Source Project",
      exact: true,
    }),
  ).toHaveCount(1);
  expect(writes).toEqual([]);
  await page.keyboard.press("Escape");
  await page.route("**/rpc/favoritesList", (route) => route.abort());
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(favorites.getByRole("alert")).toHaveText(
    "Favorites are unavailable.",
  );
  await page.unroute("**/rpc/favoritesList");
});

test("Favorites opens every supported source and shows broken targets without private titles or fallback navigation", async ({
  context,
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get(
    `${serverUrl}/__e2e/setup?fixture=favorites-sources`,
  );
  expect(response.ok()).toBe(true);
  const setup = await response.json();
  await context.addCookies([setup.cookie]);
  await page.goto(`/projects/${setup.projectId}`);
  const sourceUrl = page.url();
  const cases = [
    ["Favorite Project", `/projects/${setup.projectId}`],
    [
      "Favorite Work",
      `/projects/${setup.projectId}#work-${setup.favorites.workId}`,
    ],
    [
      "Favorite Document",
      `/projects/${setup.projectId}#document-${setup.favorites.documentId}`,
    ],
    ["Favorite Wiki", `/personal-wiki#document-${setup.favorites.wikiId}`],
    [
      "Favorite Decision",
      `/projects/${setup.projectId}#source-decision-${setup.favorites.decisionId}`,
    ],
    [
      "Favorite Collection",
      `/projects/${setup.projectId}#smart-collection-view-${setup.favorites.viewId}`,
    ],
  ];
  for (const [title, href] of cases) {
    await page.getByRole("button", { name: "Favorites", exact: true }).click();
    const list = page.getByRole("dialog", { name: "Favorites", exact: true });
    await expect(list).toContainText("Permanently deleted");
    await expect(list).toContainText("No access");
    await expect(list).not.toContainText("Private Favorite");
    await expect(list).not.toContainText("Deleted Favorite");
    const collectionPreviewRequest =
      title === "Favorite Collection"
        ? page.waitForRequest((outgoing) =>
            outgoing.url().includes("/rpc/smartCollectionView"),
          )
        : null;
    await list
      .getByRole("button", {
        name: `Open source record: ${title}`,
        exact: true,
      })
      .click();
    if (collectionPreviewRequest) {
      expect((await collectionPreviewRequest).postDataJSON().json).toEqual({
        viewId: setup.favorites.viewId,
        readOnly: true,
      });
    }
    const preview = page.getByRole("dialog", { name: title, exact: true });
    await expect(
      preview.getByRole("link", { name: "Open full page", exact: true }),
    ).toHaveAttribute("href", href);
    await expect(preview.getByRole("alert")).toHaveCount(0);
    await expect(
      preview.getByText("Loading source record…", { exact: true }),
    ).toHaveCount(0);
    await expect(preview.locator("section").first()).toContainText(title);
    expect(page.url()).toBe(sourceUrl);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  const list = page.getByRole("dialog", { name: "Favorites", exact: true });
  await expect(
    list.getByRole("button", {
      name: "Open source record: Favorite stale document",
      exact: true,
    }),
  ).toBeVisible();
  let deletedBeforeOpening = false;
  await page.route("**/rpc/openFavoriteSource", async (route) => {
    const deleted = await request.post(
      `${serverUrl}/__e2e/favorites-delete-source?documentId=${setup.favorites.staleId}`,
    );
    deletedBeforeOpening = deleted.ok();
    await route.continue();
  });
  await list
    .getByRole("button", {
      name: "Open source record: Favorite stale document",
      exact: true,
    })
    .click();
  await expect(
    list.getByText("Favorite stale document", { exact: true }),
  ).toHaveCount(0);
  await expect(
    list.getByRole("button", {
      name: "Open source record: Favorite stale document",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    list.getByText("Source record is unavailable. Permanently deleted", {
      exact: true,
    }),
  ).toHaveCount(2);
  expect(deletedBeforeOpening).toBe(true);
  await page.unroute("**/rpc/openFavoriteSource");
  expect(page.url()).toBe(sourceUrl);
  for (const dark of [false, true]) {
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    const appearance = dark ? "Dark" : "Light";
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    const option = page.getByRole("menuitem", {
      name: appearance,
      exact: true,
    });
    if (await option.isEnabled()) {
      await option.click();
    } else {
      await page.keyboard.press("Escape");
    }
    if (dark) {
      await expect(page.locator("html")).toHaveClass(darkThemePattern);
    } else {
      await expect(page.locator("html")).not.toHaveClass(darkThemePattern);
    }
    await page.getByRole("button", { name: "Favorites", exact: true }).click();
    await expect(list).toBeVisible();
    // Contrast must be measured after the Sheet's opacity and color transitions settle.
    await page.evaluate(async () => {
      await Promise.allSettled(
        document.getAnimations().map((animation) => animation.finished),
      );
    });
    const accessibility = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withRules(["color-contrast", "button-name", "aria-dialog-name"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1200 });
  await list
    .getByRole("list", { name: "Favorites", exact: true })
    .evaluate((element) => {
      if (element.parentElement) {
        element.parentElement.scrollTop = 0;
      }
    });
  await page.screenshot({
    path: "../../.context/favorites-broken-references.png",
    animations: "disabled",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      list.getByRole("heading", { name: "Favorites", exact: true }),
    ).toBeVisible();
    await expect(
      list.getByRole("button", {
        name: "Open source record: Favorite Project",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await list.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "../../.context/favorites-large-text.png" });
});
