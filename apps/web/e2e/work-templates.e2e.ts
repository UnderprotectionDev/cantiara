import { expect, test } from "@playwright/test";
import { addDays, format } from "date-fns";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("defines, previews, edits, and trashes a Project Work Template", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=work-templates`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/projects/new");
  await page.getByLabel("Project Name").fill("Work Templates Acceptance");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page
    .getByRole("link", { name: "Work Templates Acceptance", exact: true })
    .click();
  await page.getByRole("button", { name: "Configuration Mode" }).click();

  const configuration = page.locator(
    'section[aria-label="Configuration Mode"]',
  );
  await configuration
    .getByRole("button", { name: "Custom field", exact: true })
    .click();
  const customFieldHost = configuration.getByRole("region", {
    exact: true,
    name: "Custom field",
  });
  await customFieldHost.getByLabel("Field name").fill("Release audience");
  await customFieldHost.getByRole("checkbox", { name: "Work" }).check();
  await customFieldHost
    .getByRole("button", { name: "Add custom field" })
    .click();
  await expect(
    customFieldHost.getByText("Release audience", { exact: true }),
  ).toBeVisible();

  await configuration
    .getByRole("button", { name: "Work Template", exact: true })
    .click();
  const host = configuration.getByRole("region", {
    exact: true,
    name: "Work Template",
  });
  await expect(host).toBeVisible();
  await Promise.all(
    [
      "Current status",
      "Closure result",
      "Relations",
      "History",
      "Absolute date",
      "Document Template",
      "Capture mini-template",
    ].map((label) =>
      expect(host.getByText(label, { exact: true })).toHaveCount(0),
    ),
  );

  const form = host.getByRole("form", { name: "Add Work Template" });
  await form.getByLabel("Name").fill("Release preparation");
  await form.getByLabel("Type").selectOption("Task");
  await form.getByLabel("Description skeleton").fill("## Outcome\n\n## Notes");
  await form.getByLabel("Checklist").fill("Draft release notes\nReview copy");
  await form.getByRole("checkbox", { name: "Release audience" }).check();
  await form.getByLabel("Release audience default").fill("Founders");
  await form.getByLabel("Planned start days from creation").fill("2");
  await form.getByLabel("Target days from creation").fill("10");
  const preview = form.getByLabel("Resolved dates preview");
  const creationDay = new Date();
  await expect(preview).toContainText(
    format(addDays(creationDay, 2), "yyyy-MM-dd"),
  );
  await expect(preview).toContainText(
    format(addDays(creationDay, 10), "yyyy-MM-dd"),
  );
  await form.getByRole("button", { name: "Add Work Template" }).click();

  const item = host
    .getByRole("list", { name: "Work Templates" })
    .getByRole("listitem")
    .filter({ hasText: "Release preparation" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("Release audience");
  await expect(item.getByText("Planned start", { exact: true })).toBeVisible();
  await expect(item.getByText("Target", { exact: true })).toBeVisible();

  await item.getByRole("button", { name: "Edit" }).click();
  const editForm = host.getByRole("form", { name: "Edit Work Template" });
  await editForm.getByLabel("Name").fill("Launch preparation");
  await editForm.getByRole("button", { name: "Save changes" }).click();
  await expect(
    host.getByText("Launch preparation", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Configuration Mode" }).click();
  await configuration
    .getByRole("button", { name: "Work Template", exact: true })
    .click();
  await expect(
    host.getByText("Launch preparation", { exact: true }),
  ).toBeVisible();
  await host
    .getByRole("listitem")
    .filter({ hasText: "Launch preparation" })
    .getByRole("button", { name: "Move to Trash" })
    .click();
  await expect(
    host.getByText("Launch preparation", { exact: true }),
  ).toHaveCount(0);
});
