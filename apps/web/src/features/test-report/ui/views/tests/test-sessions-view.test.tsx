// @vitest-environment happy-dom

import type { TestSessionRecord } from "@cantiara/api/test-report";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { maskedReviewMessage } from "../../../lib/test-report-form";
import { TestSessionsView } from "../test-sessions-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const VERIFIED_WORDS = /verified|trust|score|approved|release gate/i;

const session: TestSessionRecord = {
  acceptedAt: "2026-08-06T12:31:00.000Z",
  context: null,
  endedAt: null,
  executor: { name: "Codex", type: "ai_agent", version: "1.2" },
  externalSessionId: "run-1",
  fingerprint: "abc",
  handoffId: null,
  handoffPackageVersion: null,
  handoffStateAtAccept: null,
  id: "s1",
  ingress: "File import",
  projectId: "p1",
  rawReport: null,
  reportedAt: "2026-08-06T12:30:00.000Z",
  reportedAtText: "2026-08-06T15:30:00+03:00",
  reporter: { id: "u1", kind: "user" },
  reviewState: "Unreviewed",
  schemaVersion: "test-report/1",
  startedAt: null,
  summary: "Checkout run",
  tests: [
    {
      evidence: [],
      externalTestId: "t1",
      id: "st1",
      normalizedResult: "passed",
      notes: null,
      position: 0,
      rawResult: "passed",
      relations: [],
      resultLabel: "Passed",
      scenarioId: null,
      scenarioVersion: null,
      title: "Coupon is single use",
    },
    {
      evidence: [],
      externalTestId: "t2",
      id: "st2",
      normalizedResult: "not_reported",
      notes: null,
      position: 1,
      rawResult: null,
      relations: [],
      resultLabel: "Not reported",
      scenarioId: null,
      scenarioVersion: null,
      title: "Receipt is shown",
    },
  ],
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(props: Partial<Parameters<typeof TestSessionsView>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <TestSessionsView
        onImport={vi.fn().mockResolvedValue(undefined)}
        onRecord={vi.fn().mockResolvedValue(undefined)}
        readOnly={false}
        sessions={[session]}
        {...props}
      />,
    );
  });
}

function setValue(id: string, value: string) {
  const control = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  if (!control) {
    throw new Error(`No control ${id}`);
  }
  const prototype = Object.getPrototypeOf(control);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

async function submit(formLabel: string) {
  const form = document.querySelector(`form[aria-label="${formLabel}"]`);
  if (!form) {
    throw new Error(`No ${formLabel} form`);
  }
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
}

test("lists a Test Session as Unreviewed with executor, reporter and ingress apart", () => {
  mount();
  const text = document.body.textContent ?? "";
  expect(text).toContain("Test Sessions");
  expect(text).toContain("Unreviewed");
  expect(text).toContain("Coupon is single use: Passed");
  expect(text).toContain("Receipt is shown: Not reported");
  const labels = [...document.querySelectorAll("dt")].map(
    (node) => node.textContent,
  );
  expect(labels).toEqual([
    "Executor type",
    "Executor",
    "Reporter",
    "Ingress",
    "Reported at",
  ]);
  expect(text).toContain("AI agent");
  expect(text).toContain("File import");
});

test("states a reported result is not verified acceptance and offers no score", () => {
  mount();
  const text = document.body.textContent ?? "";
  expect(text).toContain("never counts as verified product acceptance");
  expect(
    text.replace(/verified product acceptance|not verified/g, ""),
  ).not.toMatch(VERIFIED_WORDS);
});

test("offers the English result labels and no review action", () => {
  mount();
  const options = [
    ...document.querySelectorAll("#test-session-test-0-result option"),
  ].map((option) => option.textContent);
  expect(options).toEqual([
    "Passed",
    "Failed",
    "Blocked",
    "Skipped",
    "Inconclusive",
    "Not reported",
  ]);
  const buttons = [...document.querySelectorAll("button")].map(
    (button) => button.textContent,
  );
  expect(buttons).toEqual([
    "Select a date",
    "Add Session Test",
    "Record Test Session",
    "Import Test Session file",
  ]);
});

test("records nothing until Save and then sends the filled form once", async () => {
  const onRecord = vi.fn().mockResolvedValue(undefined);
  mount({ onRecord });
  setValue("test-session-executor-name", "Me");
  setValue("test-session-test-0-title", "Login works");
  setValue("test-session-test-0-result", "failed");
  expect(onRecord).not.toHaveBeenCalled();
  await submit("Record Test Session");
  expect(onRecord).toHaveBeenCalledTimes(1);
  expect(onRecord.mock.calls[0]?.[0]).toMatchObject({
    executorName: "Me",
    executorType: "user",
    tests: [{ result: "failed", title: "Login works" }],
  });
});

test("adds and removes Session Test rows with labelled controls", () => {
  mount();
  const add = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Add Session Test",
  );
  act(() => add?.click());
  expect(document.getElementById("test-session-test-1-title")).not.toBeNull();
  expect(
    document.querySelector('label[for="test-session-test-1-title"]')
      ?.textContent,
  ).toBe("Session Test 2 title");
  const remove = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Remove Session Test 2",
  );
  act(() => remove?.click());
  expect(document.getElementById("test-session-test-1-title")).toBeNull();
});

test("shows a refusal with its explanation and keeps the form values", async () => {
  const onRecord = vi.fn().mockRejectedValue(
    Object.assign(new Error("The field is missing."), {
      data: { fieldPath: "tests" },
    }),
  );
  mount({ onRecord });
  setValue("test-session-executor-name", "Me");
  setValue("test-session-test-0-title", "Login works");
  await submit("Record Test Session");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "The field is missing. Field: tests.",
  );
  expect(
    (document.getElementById("test-session-executor-name") as HTMLInputElement)
      .value,
  ).toBe("Me");
});

test("an archived Project shows the list without forms", () => {
  mount({ readOnly: true });
  expect(document.querySelector("form")).toBeNull();
  expect(document.body.textContent).toContain("Coupon is single use");
});

test("a masked review names field paths only and says nothing was saved", () => {
  expect(maskedReviewMessage({ outcome: "created" })).toBeNull();
  const message = maskedReviewMessage({
    findings: [{ fieldPath: "tests[0].notes" }],
    outcome: "masked_review",
  });
  expect(message).toContain("Nothing was saved.");
  expect(message).toContain("tests[0].notes");
});
