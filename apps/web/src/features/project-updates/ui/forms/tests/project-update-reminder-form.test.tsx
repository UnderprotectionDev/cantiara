// @vitest-environment happy-dom
import type { ProjectUpdateReminder } from "@cantiara/api/project-updates";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectUpdateReminderForm } from "../project-update-reminder-form";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const JUDGMENT_COPY = /health|score|overdue|required|late/i;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const reminder: ProjectUpdateReminder = {
  due: false,
  intervalDays: 14,
  nextDueAt: null,
  projectId: "p1",
  question: "What changed this week?",
  state: "Enabled",
};

function mount(
  overrides: Partial<ProjectUpdateReminder>,
  handlers: {
    onConfigure?: () => Promise<unknown>;
    onSkip?: () => Promise<unknown>;
  },
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ProjectUpdateReminderForm
        onConfigure={handlers.onConfigure ?? (() => Promise.resolve())}
        onSkip={handlers.onSkip ?? (() => Promise.resolve())}
        reminder={{ ...reminder, ...overrides }}
      />,
    );
  });
}

function buttonNamed(name: string) {
  return [...(host?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === name,
  );
}

describe("Project Update reminder panel", () => {
  test("shows the question and a skip action only when the reminder is due", () => {
    mount({ due: false }, {});
    expect(host?.textContent).not.toContain("Skip reminder");
    act(() => root?.unmount());
    host?.remove();
    mount({ due: true }, {});
    expect(host?.querySelector('[role="status"]')?.textContent).toContain(
      "What changed this week?",
    );
    expect(buttonNamed("Skip reminder")).toBeDefined();
  });

  test("skip calls only the skip handler", async () => {
    const onSkip = vi.fn(() => Promise.resolve());
    const onConfigure = vi.fn(() => Promise.resolve());
    mount({ due: true }, { onConfigure, onSkip });
    await act(() => {
      buttonNamed("Skip reminder")?.click();
      return Promise.resolve();
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onConfigure).not.toHaveBeenCalled();
  });

  test("saving sends the state, question and interval", async () => {
    const onConfigure = vi.fn(() => Promise.resolve());
    mount({}, { onConfigure });
    await act(() => {
      host
        ?.querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      return Promise.resolve();
    });
    expect(onConfigure).toHaveBeenCalledWith({
      intervalDays: 14,
      question: "What changed this week?",
      state: "Enabled",
    });
  });

  test("names no health, score or required cadence", () => {
    mount({ due: true }, {});
    expect(host?.textContent ?? "").not.toMatch(JUDGMENT_COPY);
  });
});
