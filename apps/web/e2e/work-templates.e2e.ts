import { expect, test } from "@playwright/test";
import { addDays, format } from "date-fns";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
const STATUS_FOR_PATTERN = /Status for/;
const TYPE_CHECKBOX_PATTERN = /Type/;

test.setTimeout(90_000);

test("manages Work Templates and previews a one-off Duplicate Work before writing", async ({
  context,
  page,
  request,
}) => {
  const reactUpdateErrors: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Maximum update depth")) {
      reactUpdateErrors.push(message.text());
    }
  });
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
  await expect(editForm.getByLabel("Name")).toHaveValue("Release preparation");
  await expect(editForm.getByLabel("Description skeleton")).toHaveValue(
    "## Outcome\n\n## Notes",
  );
  await expect(editForm.getByLabel("Checklist")).toHaveValue(
    "Draft release notes\nReview copy",
  );
  await expect(
    editForm.getByRole("checkbox", { name: "Release audience" }),
  ).toBeChecked();
  await expect(editForm.getByLabel("Release audience default")).toHaveValue(
    "Founders",
  );
  await expect(
    editForm.getByLabel("Planned start days from creation"),
  ).toHaveValue("2");
  await expect(editForm.getByLabel("Target days from creation")).toHaveValue(
    "10",
  );
  await editForm.getByLabel("Name").fill("Launch preparation");
  await editForm.getByRole("button", { name: "Save changes" }).click();
  await expect(
    host.getByText("Launch preparation", { exact: true }),
  ).toBeVisible();
  const updatedItem = host
    .getByRole("list", { name: "Work Templates" })
    .getByRole("listitem")
    .filter({ hasText: "Launch preparation" });
  await expect(updatedItem).toContainText("2 checklist items");
  await expect(updatedItem).toContainText("Release audience");
  await expect(
    updatedItem.getByText("Planned start", { exact: true }),
  ).toBeVisible();
  await expect(updatedItem.getByText("Target", { exact: true })).toBeVisible();

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

  await page.getByRole("button", { name: "Configuration Mode" }).click();
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("link", { name: "Work", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const workCreate = page.locator("#work-create");
  await workCreate.getByLabel("Title").fill("Prepare one-off launch");
  await workCreate.getByLabel("Type").selectOption("Improvement");
  await workCreate
    .getByLabel("Description")
    .fill("Keep this source description");
  await workCreate.getByLabel("Release audience").fill("Founders");
  const createWorkResponse = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().endsWith("/rpc/finalizeWorkDraft") &&
      candidate.ok(),
  );
  await workCreate.getByRole("button", { name: "Create", exact: true }).click();
  await createWorkResponse;

  const workList = page.getByRole("list", { name: "Work list" });
  const source = workList
    .getByRole("listitem")
    .filter({ hasText: "Prepare one-off launch" });
  await expect(source).toBeVisible({ timeout: 20_000 });
  await source
    .getByRole("combobox", { name: STATUS_FOR_PATTERN })
    .selectOption("In Progress");
  await expect(
    source.getByRole("combobox", { name: STATUS_FOR_PATTERN }),
  ).toHaveValue("In Progress");

  await source.getByRole("button", { name: "Duplicate Work" }).click();
  await source.getByRole("button", { name: "Preview" }).click();
  const duplicatePreview = source.getByRole("region", {
    name: "Duplicate Work preview",
  });
  await expect(duplicatePreview).toBeVisible();
  await expect(duplicatePreview).toContainText("Prepare one-off launch");
  await expect(duplicatePreview).toContainText("Improvement");
  await expect(duplicatePreview).toContainText("Keep this source description");
  await expect(duplicatePreview).toContainText("Release audience");
  await expect(duplicatePreview).toContainText("Founders");
  await expect(duplicatePreview).toContainText("Current status");
  await expect(duplicatePreview).toContainText("Absolute dates");
  await expect(
    workList
      .getByRole("listitem")
      .filter({ hasText: "Prepare one-off launch" }),
  ).toHaveCount(1);

  const typeCheckbox = duplicatePreview.getByRole("checkbox", {
    name: TYPE_CHECKBOX_PATTERN,
  });
  await typeCheckbox.uncheck();
  await expect(duplicatePreview).toContainText("Will be Task (default type)");
  await typeCheckbox.check();
  await expect(duplicatePreview).toContainText("Improvement");

  await duplicatePreview
    .getByRole("button", { name: "Confirm Duplicate" })
    .click();
  const copies = workList
    .getByRole("listitem")
    .filter({ hasText: "Prepare one-off launch" });
  await expect(copies).toHaveCount(2);
  await expect
    .poll(() =>
      copies
        .getByRole("combobox", { name: STATUS_FOR_PATTERN })
        .evaluateAll((elements) =>
          elements
            .map((element) => (element as HTMLSelectElement).value)
            .sort(),
        ),
    )
    .toEqual(["In Progress", "Not Started"]);
  await expect
    .poll(() =>
      copies
        .getByLabel("Release audience")
        .evaluateAll((elements) =>
          elements.map((element) => (element as HTMLInputElement).value),
        ),
    )
    .toEqual(["Founders", "Founders"]);
  expect(reactUpdateErrors).toEqual([]);
});
