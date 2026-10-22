// @vitest-environment happy-dom

import type { TestAssessmentRecord } from "@cantiara/api/test-assessments";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { TestAssessmentsView } from "../test-assessments-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SCORE_WORDS = /score|coverage|gate|readiness|evidence/i;

const saved: TestAssessmentRecord = {
  assessedAt: "2026-10-01T09:00:00.000Z",
  assessorAccountId: "founder",
  context: { kind: "Project Release", label: "v1.2", targetId: "r1" },
  decision: "Acceptable",
  followUpWorkIds: ["w1"],
  gapIds: ["g1"],
  id: "a1",
  knownLimits: "Wallet payments were not tried.",
  newContext: null,
  projectId: "p1",
  sessionIds: ["s1", "s2"],
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mount(
  props: Partial<Parameters<typeof TestAssessmentsView>[0]> = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <TestAssessmentsView
          assessments={[saved]}
          loadContextTargets={vi
            .fn()
            .mockResolvedValue([
              { id: "r1", kind: "Project Release", label: "v1.2" },
            ])}
          onRecord={vi.fn().mockResolvedValue(undefined)}
          {...props}
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await settle();
  });
}

function setValue(id: string, value: string) {
  const control = document.getElementById(id) as
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  if (!control) {
    throw new Error(`No control ${id}`);
  }
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(control),
    "value",
  )?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

test("lists the saved snapshot with its decision, ids and no score", async () => {
  await mount();
  const text = host?.textContent ?? "";
  expect(text).toContain("Recent Test Assessments");
  expect(text).toContain("Project Release: v1.2");
  expect(text).toContain("Decision at the time: Acceptable");
  expect(text).toContain("s1, s2");
  expect(text).not.toContain("New test context after this assessment");
  expect(host?.querySelector("li")?.textContent ?? "").not.toMatch(SCORE_WORDS);
});

test("shows the assessment time with the account Date format and Time zone", async () => {
  await mount({
    preferences: {
      appearance: "Dark",
      dateFormat: "yyyy-MM-dd",
      firstDayOfWeek: "Monday",
      locale: "en-GB",
      timeZone: "Europe/Istanbul",
    },
  });
  expect(host?.textContent).toContain("Assessed 2026-10-01 12:00 by founder");
});

test("shows the new-context notice with exact sources and keeps the decision", async () => {
  await mount({
    assessments: [
      {
        ...saved,
        newContext: {
          sources: [
            {
              kind: "New result",
              recordedAt: "2026-10-02T09:00:00.000Z",
              sourceId: "s9",
              sourceKind: "Test Session",
            },
          ],
        },
      },
    ],
  });
  const notice = host?.querySelector(
    '[aria-label="New test context after this assessment"]',
  );
  expect(notice?.textContent).toContain("New result: Test Session s9");
  expect(host?.textContent).toContain("Decision at the time: Acceptable");
});

test("shows an alert with a retry action when the context list fails to load", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("down"))
    .mockResolvedValue([{ id: "f1", kind: "Feature", label: "Checkout" }]);
  await mount({ assessments: [], loadContextTargets: load, onRecord });
  expect(host?.querySelector('p[role="alert"]')?.textContent).toContain(
    "The Feature list is unavailable.",
  );
  await act(async () => {
    (
      host?.querySelector('form button[type="button"]') as HTMLButtonElement
    )?.click();
    await settle();
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(host?.querySelector('p[role="alert"]')).toBeNull();
  expect(
    (host?.querySelector("#test-assessment-context") as HTMLSelectElement)
      ?.textContent,
  ).toContain("Checkout");
  expect(onRecord).not.toHaveBeenCalled();
});

test("records a snapshot from the keyboard-operable form", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  await mount({ assessments: [], onRecord });
  expect(host?.textContent).toContain("Publishing never needs one.");
  setValue("test-assessment-context", "r1");
  setValue("test-assessment-sessionIds", "s1\ns2");
  setValue("test-assessment-decision", "Follow-up needed");
  const form = host?.querySelector('form[aria-label="Record Test Assessment"]');
  await act(() => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(onRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      contextId: "r1",
      contextKind: "Feature",
      decision: "Follow-up needed",
      sessionIds: "s1\ns2",
    }),
  );
  const options = [
    ...(host?.querySelectorAll("#test-assessment-decision option") ?? []),
  ]
    .map((option) => option.textContent)
    .filter((text) => text && !text.startsWith("Choose"));
  expect(options).toEqual(["Acceptable", "Follow-up needed", "Undecided"]);
});
