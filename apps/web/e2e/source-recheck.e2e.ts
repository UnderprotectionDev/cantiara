// biome-ignore-all lint/performance/noAwaitInLoops: The keyboard journey binds each target separately.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);
const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
for (const run of [1, 2]) {
  test(`Source Check keeps an independent historical baseline on run ${run}`, async ({
    context,
    page,
    request,
  }) => {
    const response = await request.get(
      `${serverUrl}/__e2e/setup?fixture=source-recheck`,
    );
    expect(response.ok()).toBe(true);
    const setup = await response.json();
    await context.addCookies([setup.cookie]);
    await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
    const preview = page.getByRole("region", {
      name: "Smart link preview",
      exact: true,
    });
    await preview
      .getByLabel("Source URL")
      .fill(`https://example.org/recheck-journey?fixture=${setup.projectId}`);
    await preview.getByRole("button", { name: "Preview", exact: true }).click();
    await preview
      .getByRole("button", { name: "Save as Source", exact: true })
      .click();
    await expect(preview).toContainText("Source saved.");
    const article = page.locator("#sources article");
    await expect(
      article.getByRole("button", {
        name: "Version-pinned evidence",
        exact: true,
      }),
    ).toBeVisible({ timeout: 5000 });
    await article
      .getByRole("button", { name: "Version-pinned evidence", exact: true })
      .click();
    for (const label of [
      "Work: Live Work source",
      "Decision: Freshness Decision",
      "Feedback: Freshness Feedback",
    ]) {
      await article
        .getByRole("button", {
          name: "Bind as evidence to existing record",
          exact: true,
        })
        .click();
      const selection = article.getByRole("group", {
        name: "Evidence selection",
        exact: true,
      });
      await selection.getByLabel("Evidence target").selectOption({ label });
      await selection.getByLabel("Source text").focus();
      await page.keyboard.press("ControlOrMeta+A");
      await selection
        .getByRole("button", { name: "Preview", exact: true })
        .click();
      await expect(
        selection.getByRole("group", { name: "Evidence preview", exact: true }),
      ).toBeVisible({ timeout: 5000 });
      await selection
        .getByRole("button", {
          name: "Bind as evidence to existing record",
          exact: true,
        })
        .click();
      await expect(
        article.getByRole("group", {
          name: `Evidence use: ${label}`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await article
      .getByRole("button", { name: "Source Check", exact: true })
      .click();
    await expect(article).toContainText("third-party server");
    await article
      .getByRole("button", { name: "Recheck source", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const candidate = article.getByRole("group", {
      name: "Candidate snapshot",
      exact: true,
    });
    await expect(candidate).toContainText("Revised research finding.");
    await expect(
      article.getByRole("group", { name: "Historical snapshot", exact: true }),
    ).toContainText("Original research finding.");
    await expect(article).toContainText("No match in candidate version");
    await article
      .getByRole("group", { name: "Source Check", exact: true })
      .screenshot({ path: "../../.context/source-recheck-comparison.png" });
    await article
      .getByRole("button", { name: "Save as new Source version", exact: true })
      .click();
    await expect(article).toContainText(
      "Save as new Source version · Version 2",
    );
    await expect(article).toContainText(
      "source-version-in-use · 3 uses to review",
    );
    const workUse = article.getByRole("group", {
      name: "Evidence use: Work: Live Work source",
      exact: true,
    });
    await workUse
      .getByRole("button", {
        name: "Reviewed; keep current version",
        exact: true,
      })
      .click();
    await expect(article).toContainText(
      "source-version-in-use · 2 uses to review",
    );
    const decisionUse = article.getByRole("group", {
      name: "Evidence use: Decision: Freshness Decision",
      exact: true,
    });
    await decisionUse
      .getByRole("button", { name: "Newer Source version exists", exact: true })
      .click();
    const rebind = article.getByRole("group", {
      name: "Evidence selection",
      exact: true,
    });
    await expect(rebind).toContainText("Original research finding.");
    await rebind.getByLabel("Source text").focus();
    await page.keyboard.press("ControlOrMeta+A");
    await rebind.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      rebind.getByRole("group", { name: "Evidence preview", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await rebind
      .getByRole("button", { name: "Rebind to new version", exact: true })
      .click();
    await expect(decisionUse).toContainText("Version 2");
    await expect(article).toContainText(
      "source-version-in-use · 1 uses to review",
    );
    await page.reload();
    await article
      .getByRole("button", { name: "Version-pinned evidence", exact: true })
      .click();
    await expect(workUse).toContainText("Version 1");
    await expect(workUse).toContainText("Reviewed; keep current version");
    await expect(decisionUse).toContainText("Version 2");
    const feedbackUse = article.getByRole("group", {
      name: "Evidence use: Feedback: Freshness Feedback",
      exact: true,
    });
    await feedbackUse
      .getByRole("button", {
        name: "Reviewed; keep current version",
        exact: true,
      })
      .click();
    await expect(article).not.toContainText("source-version-in-use");
    await expect(article).toContainText("Revised research finding.");
    await article
      .getByRole("button", { name: "Source Check", exact: true })
      .click();
    await expect(
      article.getByRole("group", { name: "Historical snapshot", exact: true }),
    ).toContainText("Original research finding.");
    await article
      .getByRole("button", { name: "Recheck source", exact: true })
      .click();
    await article
      .getByRole("button", { name: "Keep current version", exact: true })
      .click();
    await expect(article).toContainText("Keep current version");
    const audit = await new AxeBuilder({ page }).include("#sources").analyze();
    expect(audit.violations).toEqual([]);
  });
}
