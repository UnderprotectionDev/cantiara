// biome-ignore-all lint/performance/noAwaitInLoops: The browser must visit each Consent state in order.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectDateTime, pickDateTime } from "./date-picker-helpers";

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
  await pickDateTime(page, sessions, "Time", "2026-10-10T14:00");
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
  await expectDateTime(sessions, "Time", "2026-10-10T14:00");
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
    await pickDateTime(page, sessions, "Time", time);
    await sessions
      .getByRole("button", {
        name: time === "2026-03-08T02:30" ? "Save" : "Retry",
        exact: true,
      })
      .click();
    await expect(sessions.getByRole("alert")).toContainText(
      "Time is skipped or repeated",
    );
    await expectDateTime(sessions, "Time", time);
  }
  await pickDateTime(page, sessions, "Time", "2026-11-01T03:30");
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
  await expectDateTime(sessions, "Time", "2026-11-01T03:30");
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
              speakerLabel: null,
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

test("typed Research Session notes remain distinct through save, edit, retry and Consent refusal", async ({
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
  await sessions
    .getByLabel("Title", { exact: true })
    .fill("Typed export interview");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Understand export behavior");
  await sessions.getByLabel("Consent", { exact: true }).selectOption("Allowed");
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sessions).toContainText("Research Session saved.");
  const notes = page.getByRole("region", {
    name: "Notes for Typed export interview",
    exact: true,
  });
  for (const [kind, text] of [
    ["Participant quote", "I need CSV exports"],
    ["Observation", "The participant opened the menu three times"],
    ["Founder interpretation", "A shorter menu may help"],
  ]) {
    await notes.getByRole("button", { name: "Add note", exact: true }).click();
    await expect(notes.getByRole("textbox")).toHaveCount(0);
    await notes.getByLabel("Note type", { exact: true }).selectOption(kind);
    await notes.getByLabel(kind, { exact: true }).fill(text);
    if (kind === "Participant quote") {
      await notes
        .getByLabel("Speaker label (optional)", { exact: true })
        .fill("Participant A");
      await page.route(
        "**/rpc/saveResearchSessionNote",
        (route) =>
          route.fulfill({ status: 503, body: "Temporarily unavailable" }),
        { times: 1 },
      );
      await notes.getByRole("button", { name: "Save", exact: true }).click();
      await expect(notes.getByRole("alert")).toContainText(
        "could not be saved",
      );
      await expect(notes.getByLabel(kind, { exact: true })).toHaveValue(text);
      await notes.getByRole("button", { name: "Retry", exact: true }).focus();
      await page.keyboard.press("Enter");
    } else {
      await notes.getByRole("button", { name: "Save", exact: true }).click();
    }
    await expect(
      notes.getByRole("article", { name: kind, exact: true }),
    ).toContainText(text);
  }
  await page.reload();
  await expect(notes.getByRole("article")).toHaveCount(3);
  const interpretation = notes.getByRole("article", {
    name: "Founder interpretation",
    exact: true,
  });
  await interpretation
    .getByRole("button", { name: "Edit note", exact: true })
    .click();
  await expect(notes.getByLabel("Note type", { exact: true })).toBeDisabled();
  await notes
    .getByRole("textbox", { name: "Founder interpretation", exact: true })
    .fill("An explicit export action may help");
  await notes.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(interpretation).toContainText("A shorter menu may help");
  await interpretation
    .getByRole("button", { name: "Edit note", exact: true })
    .click();
  await notes
    .getByRole("textbox", { name: "Founder interpretation", exact: true })
    .fill("An explicit export action may help");
  await notes.getByRole("button", { name: "Save", exact: true }).click();
  await expect(interpretation).toContainText(
    "An explicit export action may help",
  );
  await sessions.getByRole("button", { name: "Edit", exact: true }).click();
  await sessions
    .getByLabel("Consent", { exact: true })
    .selectOption("Not allowed");
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sessions).toContainText("Consent: Not allowed");
  await notes.getByRole("button", { name: "Add note", exact: true }).click();
  await notes
    .getByLabel("Note type", { exact: true })
    .selectOption("Participant quote");
  await expect(
    notes.getByRole("textbox", { name: "Participant quote", exact: true }),
  ).toBeDisabled();
  await expect(
    notes.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await notes
    .getByLabel("Note type", { exact: true })
    .selectOption("Observation");
  await notes
    .getByRole("textbox", { name: "Observation", exact: true })
    .fill("The menu took several attempts");
  await expect(
    notes.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await notes
    .getByRole("checkbox", {
      name: "Contains personal information",
      exact: true,
    })
    .uncheck();
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="Research Sessions"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await notes.getByRole("button", { name: "Save", exact: true }).click();
  await expect(notes.getByRole("article")).toHaveCount(4);
  await page.reload();
  await expect(interpretation).toContainText(
    "An explicit export action may help",
  );
  await expect(notes.getByRole("article")).toHaveCount(4);
  await notes.screenshot({ path: "../../.context/research-notes.png" });
});

test("research conversion previews one record, cancels, retries and keeps a version-pinned excerpt after editing", async ({
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
  await sessions
    .getByLabel("Title", { exact: true })
    .fill("CSV evidence interview");
  await sessions
    .getByLabel("Purpose", { exact: true })
    .fill("Understand exports");
  await sessions.getByLabel("Consent", { exact: true }).selectOption("Allowed");
  await sessions.getByRole("button", { name: "Save", exact: true }).click();
  const notes = page.getByRole("region", {
    name: "Notes for CSV evidence interview",
    exact: true,
  });
  await notes.getByRole("button", { name: "Add note", exact: true }).click();
  await notes
    .getByLabel("Note type", { exact: true })
    .selectOption("Participant quote");
  await notes
    .getByLabel("Participant quote", { exact: true })
    .fill("Please use CSV exports today.");
  await notes.getByRole("button", { name: "Save", exact: true }).click();
  const quote = notes.getByRole("article", {
    name: "Participant quote",
    exact: true,
  });
  await quote
    .getByRole("button", {
      name: "Convert to new record and bind",
      exact: true,
    })
    .click();
  const editor = notes.getByRole("region", {
    name: "Convert to new record and bind",
    exact: true,
  });
  await expect(
    editor.getByRole("combobox", { name: "Target type", exact: true }),
  ).toHaveValue("");
  await expect(
    editor.getByRole("button", { name: "Preview", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("combobox", { name: "Target type", exact: true })
    .selectOption("Assumption");
  await editor.getByLabel("Title", { exact: true }).fill("CSV export demand");
  await editor.getByLabel("Selection start", { exact: true }).fill("11");
  await editor.getByLabel("Selection end", { exact: true }).fill("22");
  await expect(editor).toContainText("Range 11–22: CSV exports");
  await editor.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(editor).toContainText("range 11–22");
  await expect(editor.getByRole("definition")).toContainText([
    "CSV export demand",
    "CSV exports",
  ]);
  const audit = await new AxeBuilder({ page })
    .include('[aria-label="Research Sessions"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  await editor.screenshot({
    path: "../../.context/research-conversion-preview.png",
  });
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    notes.getByRole("article", {
      name: "Version-pinned evidence",
      exact: true,
    }),
  ).toHaveCount(0);
  await quote
    .getByRole("button", {
      name: "Convert to new record and bind",
      exact: true,
    })
    .click();
  await editor
    .getByRole("combobox", { name: "Target type", exact: true })
    .selectOption("Feedback");
  await editor
    .getByLabel("Title", { exact: true })
    .fill("CSV original message");
  await editor.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(editor).toContainText("Original message");
  await page.route(
    "**/rpc/confirmResearchSessionBinding",
    (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }),
    { times: 1 },
  );
  await editor.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "could not be confirmed",
  );
  await editor.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  const evidence = notes.getByRole("article", {
    name: "Version-pinned evidence",
    exact: true,
  });
  await expect(evidence).toHaveCount(1);
  await expect(evidence).toContainText("Feedback: CSV original message");
  await quote.getByRole("button", { name: "Edit note", exact: true }).click();
  await notes
    .getByRole("textbox", { name: "Participant quote", exact: true })
    .fill("PDF instead");
  await notes.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(quote).toContainText("PDF instead");
  await expect(evidence).toContainText("Please use CSV exports today.");
  await expect(evidence).toContainText("Newer version exists");
  await expect(evidence).toHaveCount(1);
  await quote
    .getByRole("button", {
      name: "Bind as evidence to existing record",
      exact: true,
    })
    .click();
  const bind = notes.getByRole("region", {
    name: "Bind as evidence to existing record",
    exact: true,
  });
  await bind
    .getByRole("combobox", { name: "Target type", exact: true })
    .selectOption("Feedback");
  await bind
    .getByRole("combobox", { name: "Target record", exact: true })
    .selectOption({ label: "CSV original message" });
  await bind.getByRole("button", { name: "Preview", exact: true }).click();
  await bind.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(evidence).toHaveCount(2);
  await page.reload();
  await expect(evidence).toHaveCount(2);
});
