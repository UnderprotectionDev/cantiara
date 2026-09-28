import { expect, test } from "@playwright/test";

const serverUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3100"}`;

test("rejecting a Daily Focus candidate hides it only from the current view", async ({
  context,
  page,
  request,
}) => {
  const setupResponse = await request.get(
    `${serverUrl}/__e2e/setup?fixture=project-shell`,
  );
  expect(setupResponse.ok()).toBe(true);
  const setup = (await setupResponse.json()) as {
    cookie: Parameters<typeof context.addCookies>[0][number];
  };
  await context.addCookies([{ ...setup.cookie, expires: -1 }]);

  let membershipWrites = 0;
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("/rpc/addToDailyFocus")) {
      membershipWrites += 1;
    }
  });
  await page.route("**/rpc/dailyFocusDay**", (route) =>
    route.fulfill({
      json: {
        json: {
          available: [
            {
              id: "candidate-work",
              key: "ALPHA-1",
              projectId: "candidate-project",
              projectName: "Candidate Project",
              status: "Not Started",
              title: "Prepare the release",
            },
          ],
          candidates: [
            {
              id: "candidate-work",
              key: "ALPHA-1",
              projectId: "candidate-project",
              projectName: "Candidate Project",
              reasons: [{ date: "2026-09-28", label: "Target date is near" }],
              status: "Not Started",
              title: "Prepare the release",
            },
          ],
          events: [],
          focusDate: "2026-09-27",
          members: [],
        },
      },
    }),
  );

  await page.goto("/daily-focus?day=2026-09-27");

  const candidates = page.getByRole("region", { name: "Candidates" });
  await expect(candidates.getByText("Prepare the release")).toBeVisible();
  await candidates.getByRole("button", { name: "Reject" }).click();
  await expect(
    candidates.getByText("No Candidates for this day."),
  ).toBeVisible();
  await expect(
    page.getByText("No Work in Daily Focus for this day.", { exact: true }),
  ).toBeVisible();
  expect(membershipWrites).toBe(0);

  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Candidates" })
      .getByText("Prepare the release"),
  ).toBeVisible();
});
