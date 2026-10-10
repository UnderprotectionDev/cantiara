// biome-ignore-all lint/performance/noAwaitInLoops: The browser must visit each Consent state in order.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;
test("Research Session consent context persists, preserves cancelled drafts, and supports keyboard retry", async ({
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
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const sessions = page.getByRole("region", {
    name: "Research Sessions",
    exact: true,
  });
  await sessions
    .getByRole("button", { name: "Create Research Session", exact: true })
    .click();
  await sessions.getByLabel("Title", { exact: true }).fill("Export interview");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Understand export needs");
  await sessions
    .getByLabel("Question guide (optional)", { exact: true })
    .fill("Which formats do you use?");
  await sessions
    .getByLabel("Consent", { exact: true })
    .selectOption("Not allowed");
  await expect(sessions).toContainText(
    "Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed.",
  );
  await sessions
    .getByLabel("Time (optional)", { exact: true })
    .fill("2026-10-10T14:00");
  await sessions
    .getByLabel("Duration (minutes, optional)", { exact: true })
    .fill("45");
  await page.route(
    "**/rpc/saveResearchSession",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sessions.getByRole("alert")).toContainText("could not be saved");
  await expect(sessions.getByLabel("Purpose", { exact: true })).toHaveValue(
    "Understand export needs",
  );
  await sessions.getByRole("button", { name: "Retry", exact: true }).focus();
  const savedResponse = page.waitForResponse("**/rpc/saveResearchSession");
  await page.keyboard.press("Enter");
  const saved = await (await savedResponse).json();
  expect(saved.json.scheduledAt).toBe("2026-10-10T11:00:00.000Z");
  await expect(sessions).toContainText("Research Session saved.");
  await page.reload();
  await expect(sessions).toContainText("Not allowed");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await sessions.getByLabel("Consent", { exact: true }).selectOption("Allowed");
  await sessions.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(sessions).toContainText("Not allowed");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  for (const consent of [
    "Not asked",
    "Allowed",
    "Not allowed",
    "Not applicable",
  ]) {
    await sessions.getByLabel("Consent", { exact: true }).selectOption(consent);
    await expect(sessions).toContainText(
      consent === "Allowed" || consent === "Not applicable"
        ? "Convert still requires a preview."
        : "sharing and publishing are closed.",
    );
  }
  await sessions
    .getByLabel("Status", { exact: true })
    .selectOption("Completed");
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="Research Sessions"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(sessions).toContainText("Completed · Consent: Not applicable");
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    sessions.getByLabel("Question guide (optional)", { exact: true }),
  ).toHaveValue("Which formats do you use?");
  await expect(
    sessions.getByLabel("Time (optional)", { exact: true }),
  ).toHaveValue("2026-10-10T14:00");
  await expect(
    sessions.getByLabel("Duration (minutes, optional)", { exact: true }),
  ).toHaveValue("45");
});

test("Research Session refuses skipped and repeated account-zone times and preserves exact saved timestamps", async ({
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
  await page.goto("/account/preferences");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/projects/${setup.projectId}#project-area-discovery`);
  const sessions = page.getByRole("region", {
    name: "Research Sessions",
    exact: true,
  });
  await sessions
    .getByRole("button", { name: "Create Research Session", exact: true })
    .click();
  await sessions
    .getByLabel("Title", { exact: true })
    .fill("Clock change interview");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Understand scheduling needs");
  await expect(sessions).toContainText(
    "Time uses your account time zone: America/New_York.",
  );
  for (const time of ["2026-03-08T02:30", "2026-11-01T01:30"]) {
    await sessions.getByLabel("Time (optional)", { exact: true }).fill(time);
    await sessions
      .getByRole("button", {
        name: time === "2026-03-08T02:30" ? "Save" : "Retry",
        exact: true,
      })
      .click();
    await expect(sessions.getByRole("alert")).toContainText(
      "Time is skipped or repeated",
    );
    await expect(
      sessions.getByLabel("Time (optional)", { exact: true }),
    ).toHaveValue(time);
  }
  await sessions
    .getByLabel("Time (optional)", { exact: true })
    .fill("2026-11-01T03:30");
  const savedResponse = page.waitForResponse("**/rpc/saveResearchSession");
  await sessions.getByRole("button", { name: "Retry", exact: true }).click();
  const saved = (await (await savedResponse).json()).json;
  expect(saved.scheduledAt).toBe("2026-11-01T08:30:00.000Z");
  await expect(sessions).toContainText("Research Session saved.");
  // The consuming record API may also receive timestamps with seconds.
  const preciseTimestamp = "2026-11-01T08:30:42.123Z";
  const exact = await request.post(`${serverUrl}/rpc/saveResearchSession`, {
    headers: {
      Cookie: `${setup.cookie.name}=${setup.cookie.value}`,
      Origin: `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? "4173"}`,
    },
    data: {
      json: {
        id: saved.id,
        projectId: setup.projectId,
        baseRevision: saved.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        fields: {
          title: saved.title,
          purpose: saved.purpose,
          consent: saved.consent,
          scheduledAt: preciseTimestamp,
        },
      },
    },
  });
  expect(exact.ok(), await exact.text()).toBe(true);
  await page.reload();
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    sessions.getByLabel("Time (optional)", { exact: true }),
  ).toHaveValue("2026-11-01T03:30");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Updated scheduling purpose");
  const updatedResponse = page.waitForResponse("**/rpc/saveResearchSession");
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  expect((await (await updatedResponse).json()).json.scheduledAt).toBe(
    preciseTimestamp,
  );
});

test("Kişisel veri research consent fixture enforces protected RPC capture and preview gates", async ({
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=personal-data`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  const headers = {
    Cookie: `${setup.cookie.name}=${setup.cookie.value}`,
    Origin: `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? "4173"}`,
  };
  const listResponse = await request.post(
    `${serverUrl}/rpc/projectResearchSessions`,
    { headers, data: { json: { projectId: setup.projectId } } },
  );
  expect(listResponse.ok()).toBe(true);
  const { records } = (await listResponse.json()).json;
  expect(
    records.map((record: { consent: string }) => record.consent).sort(),
  ).toEqual(["Allowed", "Not allowed", "Not applicable", "Not asked"]);
  for (const record of records) {
    const contentId = crypto.randomUUID();
    const capture = await request.post(
      `${serverUrl}/rpc/captureResearchSessionContent`,
      {
        headers,
        data: {
          json: {
            id: record.id,
            projectId: setup.projectId,
            baseRevision: record.revision,
            clientIdempotencyKey: crypto.randomUUID(),
            content: {
              id: contentId,
              kind: "Participant quote",
              text: "Use CSV",
              speakerLabel: "Participant A",
              relationIds: ["private-relation"],
            },
          },
        },
      },
    );
    const permitted =
      record.consent === "Allowed" || record.consent === "Not applicable";
    expect(capture.status()).toBe(permitted ? 200 : 403);
    const preview = await request.post(
      `${serverUrl}/rpc/previewResearchSessionSnapshot`,
      {
        headers,
        data: {
          json: {
            id: record.id,
            projectId: setup.projectId,
            selection: { contentIds: [contentId] },
          },
        },
      },
    );
    expect(preview.ok()).toBe(true);
    const items = (await preview.json()).json;
    expect(items).toEqual(
      permitted
        ? [
            {
              id: contentId,
              kind: "Participant quote",
              text: "Use CSV",
              speakerLabel: "Participant A",
              relationIds: [],
            },
          ]
        : [],
    );
    const convert = await request.post(
      `${serverUrl}/rpc/previewResearchSessionConvert`,
      {
        headers,
        data: {
          json: { id: record.id, projectId: setup.projectId, contentId },
        },
      },
    );
    expect(convert.ok()).toBe(permitted);
    if (!permitted) {
      const widened = await request.post(
        `${serverUrl}/rpc/saveResearchSession`,
        {
          headers,
          data: {
            json: {
              id: record.id,
              projectId: setup.projectId,
              baseRevision: record.revision,
              clientIdempotencyKey: crypto.randomUUID(),
              fields: {
                title: record.title,
                purpose: record.purpose,
                consent: "Allowed",
              },
            },
          },
        },
      );
      expect(widened.ok()).toBe(true);
      expect((await widened.json()).json.content).toEqual([]);
      const afterWidening = await request.post(
        `${serverUrl}/rpc/previewResearchSessionSnapshot`,
        {
          headers,
          data: {
            json: {
              id: record.id,
              projectId: setup.projectId,
              selection: { contentIds: [contentId], participant: true },
            },
          },
        },
      );
      expect(afterWidening.ok()).toBe(true);
      expect((await afterWidening.json()).json).toEqual([]);
    }
  }
  const denied = await request.post(
    `${serverUrl}/rpc/previewResearchSessionSnapshot`,
    {
      data: {
        json: { id: records[0].id, projectId: setup.projectId, selection: {} },
      },
    },
  );
  expect(denied.status()).toBe(401);
});
