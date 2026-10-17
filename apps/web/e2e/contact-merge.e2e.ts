import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test.setTimeout(120_000);

test("merges duplicate Contacts only after the Merge Preview is confirmed", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=contact-merge`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/contacts");
  const createSection = page.getByRole("region", {
    exact: true,
    name: "Create Contact",
  });
  const contactList = page.getByRole("region", {
    exact: true,
    name: "Contacts",
  });
  async function createContact(displayName: string) {
    await createSection.getByLabel("Display name").fill(displayName);
    await createSection.getByLabel("Email").fill("ada@example.com");
    await createSection.getByRole("button", { name: "Create Contact" }).click();
    await expect(
      contactList.getByRole("button", { exact: true, name: displayName }),
    ).toBeVisible();
  }

  await createContact("Ada");
  await createContact("Ada L.");

  const candidates = page.getByRole("region", {
    exact: true,
    name: "Duplicate candidates",
  });
  await candidates
    .getByLabel("Surviving Contact")
    .selectOption({ label: "Ada" });
  await candidates.getByRole("button", { name: "Merge Contacts" }).click();

  const preview = page.getByRole("region", {
    exact: true,
    name: "Merge Preview",
  });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByText("Display name: keeps Ada, drops Ada L."),
  ).toBeVisible();
  // Nothing is written until the founder confirms.
  await expect(contactList.getByRole("button")).toHaveCount(2);

  await preview.getByRole("button", { name: "Confirm Merge" }).click();

  await expect(preview).toBeHidden();
  await expect(contactList.getByRole("button")).toHaveCount(1);
  await expect(
    contactList.getByRole("button", { exact: true, name: "Ada" }),
  ).toBeVisible();
  await expect(candidates.getByText("No duplicate candidates.")).toBeVisible();
});

test("undoes a Contact merge from the redirected origin only after Confirm Undo Merge", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=contact-merge-undo`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
    mergedContactRetiredId: string;
  };
  await context.addCookies([setup.cookie]);

  await page.goto(`/contacts?contact=${setup.mergedContactRetiredId}`);
  const contactList = page.getByRole("region", {
    exact: true,
    name: "Contacts",
  });
  await expect(page.getByText("Redirected from")).toBeVisible();
  await expect(contactList.getByRole("button")).toHaveCount(1);

  await page.getByRole("button", { name: "Undo Merge" }).click();
  const preview = page.getByRole("region", {
    exact: true,
    name: "Undo Merge Preview",
  });
  await expect(preview).toBeVisible();
  // Nothing is written until the founder confirms.
  await expect(contactList.getByRole("button")).toHaveCount(1);

  await preview.getByRole("button", { name: "Confirm Undo Merge" }).click();

  await expect(preview).toBeHidden();
  await expect(contactList.getByRole("button")).toHaveCount(2);
  await expect(
    contactList.getByRole("button", { exact: true, name: "Ada L." }),
  ).toBeVisible();

  await page.reload();
  await expect(contactList.getByRole("button")).toHaveCount(2);
  await expect(page.getByText("Redirected from")).toBeHidden();
});
