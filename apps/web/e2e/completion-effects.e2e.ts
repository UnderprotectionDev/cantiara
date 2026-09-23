import { expect, test } from "@playwright/test";

const E2E_SERVER_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("keeps Completion Effects samples still until Preview and saves one Account choice", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences`,
  );
  const setup = (await setupResponse.json()) as {
    cookie: {
      domain: string;
      expires?: number;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "None" | "Strict";
      secure: boolean;
      value: string;
    };
  };
  await context.addCookies([setup.cookie]);

  await page.goto("/account/completion-effects");
  await expect(
    page.getByRole("heading", { name: "Completion effects", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: "Enable" })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Calm" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Haze" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  const specimen = page.locator(".completion-effect-specimen");
  await expect(specimen).toHaveAttribute("data-previewing", "false");
  await expect(specimen.locator('[data-sample-element="calm"]')).toHaveCSS(
    "animation-name",
    "none",
  );

  const rpcRequests: string[] = [];
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("/rpc/")) {
      rpcRequests.push(browserRequest.url());
    }
  });
  await page.getByRole("button", { name: "Weave" }).click();
  await expect(page.getByRole("button", { name: "Loom" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Lattice" }).click();
  await page.getByRole("switch", { name: "Enable" }).click();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(specimen).toHaveAttribute("data-previewing", "true");
  await expect(specimen.locator('[data-sample-element="weave"]')).toHaveCSS(
    "animation-name",
    "completion-effect-weave",
  );
  await expect(page.getByRole("status")).toHaveText("Preview finished.");
  expect(rpcRequests).toEqual([]);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Completion effects saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Enable" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Weave" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Lattice" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("keeps Preview static and describes its motion under Reduce Motion", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${E2E_SERVER_URL}/__e2e/setup?fixture=account-preferences`,
  );
  const setup = (await setupResponse.json()) as {
    cookie: {
      domain: string;
      expires?: number;
      httpOnly: boolean;
      name: string;
      path: string;
      sameSite: "Lax" | "None" | "Strict";
      secure: boolean;
      value: string;
    };
  };
  await context.addCookies([setup.cookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/account/completion-effects");
  await expect(
    page.getByText("Reduce Motion is on. Preview stays still."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Static sample shown. Soft shapes drift upward and settle.",
  );
  await expect(page.locator(".completion-effect-specimen")).toHaveAttribute(
    "data-previewing",
    "false",
  );
  await expect(
    page.locator('.completion-effect-specimen [data-sample-element="calm"]'),
  ).toHaveCSS("animation-name", "none");
});
