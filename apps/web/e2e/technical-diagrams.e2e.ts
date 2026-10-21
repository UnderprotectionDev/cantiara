import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("keyboard-reachable structured outline, Diagram View and Diagram Version", async ({
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
  await page.goto(`/projects/${setup.projectId}#technical-diagrams`);

  const surface = page.getByRole("region", {
    exact: true,
    name: "Technical Diagram",
  });
  const create = surface.getByRole("form", { name: "New Technical Diagram" });
  await create.getByLabel("Title").fill("Platform");
  await create.getByRole("button", { exact: true, name: "Create" }).click();

  const card = surface.getByRole("article");
  await expect(card).toContainText("Platform");
  await card.getByLabel("Node label").fill("API");
  await card.getByRole("button", { exact: true, name: "Add node" }).click();
  const outline = card.getByRole("region", {
    name: "Technical Diagram outline",
  });
  await expect(outline).toContainText("API · Component");

  const view = card.getByRole("region", { exact: true, name: "Diagram View" });
  await view.getByLabel("Name", { exact: true }).fill("API only");
  await view.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(view).toContainText("API only: 1 nodes");

  const versions = card.getByRole("region", {
    exact: true,
    name: "Diagram Version",
  });
  await versions.getByLabel("Diagram Version name").fill("Baseline");
  await versions
    .getByRole("button", { exact: true, name: "Create Diagram Version" })
    .click();
  await expect(versions.getByRole("list")).toContainText("Baseline");

  await card.getByLabel("Node label").fill("Cache");
  await card.getByRole("button", { exact: true, name: "Add node" }).click();
  await expect(outline).toContainText("Cache · Component");

  await versions
    .getByRole("button", { name: "Restore Diagram Version Baseline" })
    .click();
  await expect(outline).not.toContainText("Cache");
  await expect(outline).toContainText("API · Component");
  await expect(versions.getByRole("list")).toContainText("Baseline");
  await expect(versions).toContainText("the Diagram Version stays unchanged");
});
